// ABOUTME: CLI argument parsing and validation.
// ABOUTME: Uses commander for a polished CLI experience.

import { Command } from 'commander';
import type { ValidatorConfig } from '../validators/index.js';
import { getStandardNames } from '../standards/index.js';

export type ReportFormat = 'text' | 'json' | 'markdown' | 'html' | 'junit';
export type StandardName = 'openai' | 'mcp-apps';

export interface CLIOptions {
  format: ReportFormat;
  output?: string;
  verbose: boolean;
  quiet: boolean;
  tools: string[];
  skipExecution: boolean;
  skipContent: boolean;
  timeout: number;
  noColor: boolean;
  /** Authorization header value (e.g., Bearer token) */
  auth?: string;
  /** Custom headers as key:value pairs */
  headers: Record<string, string>;
  /** Enable tool execution (off by default for safety) */
  execute: boolean;
  /** Execute only safe tools (readOnlyHint=true) */
  executeSafe: boolean;
  /** Standard to validate against */
  standard: StandardName;
}

export interface ParsedArgs {
  url: string;
  options: CLIOptions;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const program = new Command();
  const standardNames = getStandardNames();

  program
    .name('mcp-app-lint')
    .description('Validate MCP servers against OpenAI Apps SDK or MCP Apps requirements')
    .version('0.1.0')
    .argument('<mcp-url>', 'URL of the MCP server endpoint')
    .option('-f, --format <format>', 'Output format: text, json, markdown, html, junit', 'text')
    .option('-o, --output <file>', 'Write report to file')
    .option('-v, --verbose', 'Show all checks including passed ones', false)
    .option('-q, --quiet', 'Only show errors', false)
    .option('--tools <names>', 'Only check specific tools (comma-separated)', '')
    .option('--skip-content', 'Skip content validation', false)
    .option('--execute', 'Enable tool execution (disabled by default for safety)', false)
    .option('--execute-safe', 'Execute only tools marked readOnlyHint=true', false)
    .option('--timeout <ms>', 'Request timeout in milliseconds', '10000')
    .option('--no-color', 'Disable colored output')
    .option('--auth <token>', 'Authorization header value (e.g., Bearer token)')
    .option('-H, --header <header>', 'Custom header as key:value (repeatable)', (val, prev: string[]) => {
      prev.push(val);
      return prev;
    }, [] as string[])
    .option(`-s, --standard <name>`, `Standard to validate against (${standardNames.join(', ')})`, 'openai');

  program.parse(argv);

  const url = program.args[0];
  const opts = program.opts();

  // Parse headers from -H options
  const headers: Record<string, string> = {};
  for (const h of opts.header as string[]) {
    const colonIdx = h.indexOf(':');
    if (colonIdx > 0) {
      headers[h.slice(0, colonIdx).trim()] = h.slice(colonIdx + 1).trim();
    }
  }

  // Add auth header if provided
  if (opts.auth) {
    headers['Authorization'] = opts.auth;
  }

  // Execution is DISABLED by default for safety
  const skipExecution = !opts.execute && !opts.executeSafe;

  return {
    url,
    options: {
      format: opts.format as ReportFormat,
      output: opts.output,
      verbose: opts.verbose,
      quiet: opts.quiet,
      tools: opts.tools ? opts.tools.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [],
      skipExecution,
      skipContent: opts.skipContent,
      timeout: parseInt(opts.timeout, 10),
      noColor: opts.color === false,
      auth: opts.auth,
      headers,
      execute: opts.execute,
      executeSafe: opts.executeSafe,
      standard: opts.standard as StandardName,
    },
  };
}

export function toValidatorConfig(options: CLIOptions): ValidatorConfig {
  return {
    toolFilter: options.tools,
    skipExecution: options.skipExecution,
    executeSafeOnly: options.executeSafe,
    skipContent: options.skipContent,
    timeout: options.timeout,
    verbose: options.verbose,
  };
}
