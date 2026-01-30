#!/usr/bin/env node
// ABOUTME: CLI entry point for mcp-app-lint.
// ABOUTME: Orchestrates validation pipeline and outputs report.

import { parseArgs, toValidatorConfig } from './cli/args.js';
import { MCPClient } from './client/mcp.js';
import { runValidationPipeline, type ValidationContext } from './validators/index.js';
import { ProtocolValidator } from './validators/protocol.js';
import { ToolValidator } from './validators/tools.js';
import { ResourceValidator } from './validators/resources.js';
import { ExecutionValidator } from './validators/execution.js';
import { ContentValidator } from './validators/content.js';
import { CrossValidator } from './validators/cross.js';
import { ReporterFactory } from './reporters/index.js';
import { getStandard, OPENAI_STANDARD, getPath } from './standards/index.js';
import type { StandardSpec } from './standards/spec.js';
import type { ConformanceReport, Verdict, ToolInfo, ResourceInfo } from './types/report.js';
import type { CheckResult } from './types/check.js';
import chalk from 'chalk';
import { writeFileSync } from 'node:fs';

async function main(): Promise<number> {
  const startTime = Date.now();

  // Parse arguments
  const { url, options } = parseArgs(process.argv);

  if (options.noColor) {
    chalk.level = 0;
  }

  // Get the selected standard spec
  const spec = getStandard(options.standard) ?? OPENAI_STANDARD;

  // Create client with auth headers if provided
  const client = new MCPClient({
    url,
    timeout: options.timeout,
    headers: options.headers,
  });

  // Build validator pipeline with the selected spec
  const validators = [
    new ProtocolValidator(spec),
    new ToolValidator(spec),
    new ResourceValidator(spec),
    new ExecutionValidator(spec),
    new ContentValidator(spec),
    new CrossValidator(spec),
  ];

  // Run validation
  const config = toValidatorConfig(options);

  // Create context that will be populated by validators
  const ctx: ValidationContext = { client, config };
  let checks: CheckResult[];
  let connectionFailed = false;

  try {
    checks = await runValidationPipeline(client, config, validators, ctx);

    // Check if connection/protocol failed (should return exit code 3)
    const connFailed = checks.some(c =>
      c.id.startsWith('CONN_') && !c.passed && c.severity === 'error'
    );
    if (connFailed) {
      connectionFailed = true;
    }
  } catch (error) {
    // Fatal connection error - exit code 3
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Connection failed:'), message);
    return 3;
  } finally {
    await client.close();
  }

  // Build report using context data
  const endTime = Date.now();
  const report = buildReport(url, checks, endTime - startTime, ctx, spec);

  // Format and output
  const reporter = await ReporterFactory.create(options.format);
  const output = reporter.format(report);

  if (options.output) {
    writeFileSync(options.output, output, 'utf-8');
    if (!options.quiet) {
      console.log(`Report written to ${options.output}`);
    }
  } else {
    console.log(output);
  }

  // Return exit code based on verdict (exit code 3 for connection failures)
  if (connectionFailed) {
    return 3;
  }
  switch (report.verdict) {
    case 'conformant': return 0;
    case 'conformant_with_warnings': return 1;
    case 'non_conformant': return 2;
  }
}

function buildReport(
  url: string,
  checks: CheckResult[],
  durationMs: number,
  ctx: ValidationContext,
  spec: StandardSpec
): ConformanceReport {
  const errors = checks.filter(c => !c.passed && c.severity === 'error').length;
  const warnings = checks.filter(c => !c.passed && c.severity === 'warn').length;
  const info = checks.filter(c => !c.passed && c.severity === 'info').length;
  const passed = checks.filter(c => c.passed).length;

  let verdict: Verdict;
  if (errors > 0) {
    verdict = 'non_conformant';
  } else if (warnings > 0) {
    verdict = 'conformant_with_warnings';
  } else {
    verdict = 'conformant';
  }

  // Extract server info from context (populated by protocol validator)
  const serverInfo = ctx.serverInfo ?? {};

  // Build tool and resource info from context
  const outputTemplatePath = spec.toolMeta.outputTemplate;
  const tools: ToolInfo[] = (ctx.tools ?? []).map(t => {
    const outputTemplate = getPath(t.raw, outputTemplatePath) as string | undefined;
    return {
      name: t.name,
      description: t.description,
      hasOutputTemplate: !!outputTemplate,
      outputTemplateUri: outputTemplate,
    };
  });

  const resources: ResourceInfo[] = (ctx.resources ?? []).map(r => ({
    uri: r.uri,
    name: r.name,
    mimeType: r.mimeType,
    isWidget: spec.widgetUriPattern.test(r.uri),
  }));

  return {
    serverUrl: url,
    timestamp: new Date().toISOString(),
    durationMs,
    standard: spec.name,
    standardName: spec.displayName,
    specRef: spec.specRef,
    serverInfo: serverInfo as ConformanceReport['serverInfo'],
    summary: {
      totalChecks: checks.length,
      passed,
      warnings,
      errors,
      info,
      toolCount: ctx.tools?.length ?? 0,
      resourceCount: ctx.resources?.length ?? 0,
    },
    verdict,
    checks,
    tools,
    resources,
  };
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error(chalk.red('Fatal error:'), err.message);
    process.exit(3);
  });
