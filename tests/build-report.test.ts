// Test the buildReport function by extracting its logic
// Since buildReport is not exported directly, we test the report building logic
// by importing the necessary types and recreating the logic

import { describe, it, expect } from 'vitest';
import type { CheckResult } from '../src/types/check.js';
import type { Verdict, ConformanceReport } from '../src/types/report.js';
import type { ValidationContext, ValidatorConfig } from '../src/validators/index.js';
import { OPENAI_STANDARD } from '../src/standards/openai.js';
import { MCP_APPS_STANDARD } from '../src/standards/mcp-apps.js';
import type { StandardSpec } from '../src/standards/spec.js';
import { getPath } from '../src/standards/accessor.js';

// Replicate the buildReport function from index.ts for testing
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

  const serverInfo = ctx.serverInfo ?? {};
  const outputTemplatePath = spec.toolMeta.outputTemplate;
  const tools = (ctx.tools ?? []).map(t => {
    const outputTemplate = getPath(t.raw, outputTemplatePath) as string | undefined;
    return {
      name: t.name,
      description: t.description,
      hasOutputTemplate: !!outputTemplate,
      outputTemplateUri: outputTemplate,
    };
  });

  const resources = (ctx.resources ?? []).map(r => ({
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

const defaultConfig: ValidatorConfig = {
  toolFilter: [],
  skipExecution: true,
  executeSafeOnly: false,
  skipContent: true,
  timeout: 5000,
  verbose: false,
};

describe('buildReport', () => {
  describe('verdict calculation', () => {
    it('returns conformant when all checks pass', () => {
      const checks: CheckResult[] = [
        { id: 'A', category: 'protocol', severity: 'error', passed: true, message: 'ok' },
        { id: 'B', category: 'tools', severity: 'warn', passed: true, message: 'ok' },
      ];
      const ctx: ValidationContext = { client: {} as any, config: defaultConfig };
      const report = buildReport('http://localhost', checks, 100, ctx, OPENAI_STANDARD);
      expect(report.verdict).toBe('conformant');
    });

    it('returns conformant_with_warnings when only warnings', () => {
      const checks: CheckResult[] = [
        { id: 'A', category: 'protocol', severity: 'error', passed: true, message: 'ok' },
        { id: 'B', category: 'tools', severity: 'warn', passed: false, message: 'warn' },
      ];
      const ctx: ValidationContext = { client: {} as any, config: defaultConfig };
      const report = buildReport('http://localhost', checks, 100, ctx, OPENAI_STANDARD);
      expect(report.verdict).toBe('conformant_with_warnings');
    });

    it('returns non_conformant when errors present', () => {
      const checks: CheckResult[] = [
        { id: 'A', category: 'protocol', severity: 'error', passed: false, message: 'fail' },
      ];
      const ctx: ValidationContext = { client: {} as any, config: defaultConfig };
      const report = buildReport('http://localhost', checks, 100, ctx, OPENAI_STANDARD);
      expect(report.verdict).toBe('non_conformant');
    });

    it('returns non_conformant when both errors and warnings present', () => {
      const checks: CheckResult[] = [
        { id: 'A', category: 'protocol', severity: 'error', passed: false, message: 'fail' },
        { id: 'B', category: 'tools', severity: 'warn', passed: false, message: 'warn' },
      ];
      const ctx: ValidationContext = { client: {} as any, config: defaultConfig };
      const report = buildReport('http://localhost', checks, 100, ctx, OPENAI_STANDARD);
      expect(report.verdict).toBe('non_conformant');
    });

    it('treats passing checks with error severity as passing', () => {
      const checks: CheckResult[] = [
        { id: 'A', category: 'protocol', severity: 'error', passed: true, message: 'ok' },
      ];
      const ctx: ValidationContext = { client: {} as any, config: defaultConfig };
      const report = buildReport('http://localhost', checks, 100, ctx, OPENAI_STANDARD);
      expect(report.verdict).toBe('conformant');
      expect(report.summary.errors).toBe(0);
      expect(report.summary.passed).toBe(1);
    });
  });

  describe('summary counts', () => {
    it('counts checks correctly', () => {
      const checks: CheckResult[] = [
        { id: 'A', category: 'protocol', severity: 'error', passed: true, message: 'ok' },
        { id: 'B', category: 'tools', severity: 'error', passed: false, message: 'fail' },
        { id: 'C', category: 'tools', severity: 'warn', passed: false, message: 'warn' },
        { id: 'D', category: 'tools', severity: 'info', passed: false, message: 'info' },
        { id: 'E', category: 'tools', severity: 'info', passed: true, message: 'ok' },
      ];
      const ctx: ValidationContext = { client: {} as any, config: defaultConfig };
      const report = buildReport('http://localhost', checks, 100, ctx, OPENAI_STANDARD);
      expect(report.summary.totalChecks).toBe(5);
      expect(report.summary.passed).toBe(2);
      expect(report.summary.errors).toBe(1);
      expect(report.summary.warnings).toBe(1);
      expect(report.summary.info).toBe(1);
    });

    it('counts tools and resources from context', () => {
      const ctx: ValidationContext = {
        client: {} as any,
        config: defaultConfig,
        tools: [
          { name: 'a', raw: {} },
          { name: 'b', raw: {} },
        ] as any[],
        resources: [
          { uri: 'ui://widget/a.html', raw: {} },
        ] as any[],
      };
      const report = buildReport('http://localhost', [], 100, ctx, OPENAI_STANDARD);
      expect(report.summary.toolCount).toBe(2);
      expect(report.summary.resourceCount).toBe(1);
    });

    it('defaults to 0 when tools/resources are undefined', () => {
      const ctx: ValidationContext = { client: {} as any, config: defaultConfig };
      const report = buildReport('http://localhost', [], 100, ctx, OPENAI_STANDARD);
      expect(report.summary.toolCount).toBe(0);
      expect(report.summary.resourceCount).toBe(0);
    });
  });

  describe('tool info', () => {
    it('maps tools with outputTemplate', () => {
      const ctx: ValidationContext = {
        client: {} as any,
        config: defaultConfig,
        tools: [{
          name: 'my_tool',
          description: 'desc',
          raw: { _meta: { 'openai/outputTemplate': 'ui://widget/app.html' } },
        }] as any[],
      };
      const report = buildReport('http://localhost', [], 100, ctx, OPENAI_STANDARD);
      expect(report.tools[0].name).toBe('my_tool');
      expect(report.tools[0].hasOutputTemplate).toBe(true);
      expect(report.tools[0].outputTemplateUri).toBe('ui://widget/app.html');
    });

    it('handles tool without outputTemplate', () => {
      const ctx: ValidationContext = {
        client: {} as any,
        config: defaultConfig,
        tools: [{ name: 'my_tool', raw: { _meta: {} } }] as any[],
      };
      const report = buildReport('http://localhost', [], 100, ctx, OPENAI_STANDARD);
      expect(report.tools[0].hasOutputTemplate).toBe(false);
      expect(report.tools[0].outputTemplateUri).toBeUndefined();
    });
  });

  describe('resource info', () => {
    it('identifies widget resources using spec pattern', () => {
      const ctx: ValidationContext = {
        client: {} as any,
        config: defaultConfig,
        resources: [
          { uri: 'ui://widget/app.html', name: 'App', mimeType: 'text/html+skybridge', raw: {} },
          { uri: 'http://example.com/data', name: 'Data', mimeType: 'application/json', raw: {} },
        ] as any[],
      };
      const report = buildReport('http://localhost', [], 100, ctx, OPENAI_STANDARD);
      expect(report.resources[0].isWidget).toBe(true);
      expect(report.resources[1].isWidget).toBe(false);
    });

    it('uses MCP Apps pattern for MCP Apps standard', () => {
      const ctx: ValidationContext = {
        client: {} as any,
        config: defaultConfig,
        resources: [
          { uri: 'ui://app.html', name: 'App', mimeType: 'text/html;profile=mcp-app', raw: {} },
        ] as any[],
      };
      const report = buildReport('http://localhost', [], 100, ctx, MCP_APPS_STANDARD);
      expect(report.resources[0].isWidget).toBe(true);
    });
  });

  describe('metadata', () => {
    it('includes server info from context', () => {
      const ctx: ValidationContext = {
        client: {} as any,
        config: defaultConfig,
        serverInfo: { name: 'test-server', version: '2.0', protocolVersion: '2024-11-05' },
      };
      const report = buildReport('http://localhost', [], 100, ctx, OPENAI_STANDARD);
      expect(report.serverInfo.name).toBe('test-server');
    });

    it('defaults to empty serverInfo when missing', () => {
      const ctx: ValidationContext = { client: {} as any, config: defaultConfig };
      const report = buildReport('http://localhost', [], 100, ctx, OPENAI_STANDARD);
      expect(report.serverInfo).toEqual({});
    });

    it('includes standard name and spec ref', () => {
      const ctx: ValidationContext = { client: {} as any, config: defaultConfig };
      const report = buildReport('http://localhost', [], 100, ctx, OPENAI_STANDARD);
      expect(report.standard).toBe('openai');
      expect(report.standardName).toBe('OpenAI Apps SDK');
      expect(report.specRef).toBe('https://developers.openai.com/apps-sdk/build/mcp-server');
    });

    it('includes duration and timestamp', () => {
      const ctx: ValidationContext = { client: {} as any, config: defaultConfig };
      const report = buildReport('http://localhost', [], 500, ctx, OPENAI_STANDARD);
      expect(report.durationMs).toBe(500);
      expect(report.timestamp).toBeDefined();
    });
  });
});
