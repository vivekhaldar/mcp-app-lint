import { describe, it, expect } from 'vitest';
import { parseArgs, toValidatorConfig } from '../../src/cli/args.js';
import type { CLIOptions } from '../../src/cli/args.js';

// Commander exits on --help/--version, so we need to test carefully
function parse(...args: string[]) {
  return parseArgs(['node', 'mcp-app-lint', ...args]);
}

describe('parseArgs', () => {
  it('parses URL argument', () => {
    const { url } = parse('http://localhost:3000/mcp');
    expect(url).toBe('http://localhost:3000/mcp');
  });

  it('defaults format to text', () => {
    const { options } = parse('http://localhost:3000/mcp');
    expect(options.format).toBe('text');
  });

  it('parses --format option', () => {
    const { options } = parse('http://localhost:3000/mcp', '--format', 'json');
    expect(options.format).toBe('json');
  });

  it('parses --output option', () => {
    const { options } = parse('http://localhost:3000/mcp', '--output', 'report.txt');
    expect(options.output).toBe('report.txt');
  });

  it('parses --verbose flag', () => {
    const { options } = parse('http://localhost:3000/mcp', '--verbose');
    expect(options.verbose).toBe(true);
  });

  it('parses --quiet flag', () => {
    const { options } = parse('http://localhost:3000/mcp', '--quiet');
    expect(options.quiet).toBe(true);
  });

  it('parses --tools filter', () => {
    const { options } = parse('http://localhost:3000/mcp', '--tools', 'foo,bar');
    expect(options.tools).toEqual(['foo', 'bar']);
  });

  it('handles empty tools filter', () => {
    const { options } = parse('http://localhost:3000/mcp');
    expect(options.tools).toEqual([]);
  });

  it('trims tool names', () => {
    const { options } = parse('http://localhost:3000/mcp', '--tools', 'foo , bar ');
    expect(options.tools).toEqual(['foo', 'bar']);
  });

  it('filters out empty tool names', () => {
    const { options } = parse('http://localhost:3000/mcp', '--tools', 'foo,,bar');
    expect(options.tools).toEqual(['foo', 'bar']);
  });

  it('defaults skipExecution to true (execution disabled by default)', () => {
    const { options } = parse('http://localhost:3000/mcp');
    expect(options.skipExecution).toBe(true);
  });

  it('enables execution with --execute', () => {
    const { options } = parse('http://localhost:3000/mcp', '--execute');
    expect(options.skipExecution).toBe(false);
    expect(options.execute).toBe(true);
  });

  it('enables execution with --execute-safe', () => {
    const { options } = parse('http://localhost:3000/mcp', '--execute-safe');
    expect(options.skipExecution).toBe(false);
    expect(options.executeSafe).toBe(true);
  });

  it('parses --timeout option', () => {
    const { options } = parse('http://localhost:3000/mcp', '--timeout', '30000');
    expect(options.timeout).toBe(30000);
  });

  it('defaults timeout to 10000', () => {
    const { options } = parse('http://localhost:3000/mcp');
    expect(options.timeout).toBe(10000);
  });

  it('parses --standard option', () => {
    const { options } = parse('http://localhost:3000/mcp', '--standard', 'mcp-apps');
    expect(options.standard).toBe('mcp-apps');
  });

  it('defaults standard to openai', () => {
    const { options } = parse('http://localhost:3000/mcp');
    expect(options.standard).toBe('openai');
  });

  describe('headers', () => {
    it('parses -H header', () => {
      const { options } = parse('http://localhost:3000/mcp', '-H', 'X-Custom:value');
      expect(options.headers).toEqual({ 'X-Custom': 'value' });
    });

    it('handles multiple headers', () => {
      const { options } = parse('http://localhost:3000/mcp', '-H', 'X-A:1', '-H', 'X-B:2');
      expect(options.headers).toEqual({ 'X-A': '1', 'X-B': '2' });
    });

    it('handles header with multiple colons', () => {
      const { options } = parse('http://localhost:3000/mcp', '-H', 'Auth:Bearer:token:value');
      expect(options.headers['Auth']).toBe('Bearer:token:value');
    });

    it('trims header key and value', () => {
      const { options } = parse('http://localhost:3000/mcp', '-H', ' X-Key : value ');
      expect(options.headers['X-Key']).toBe('value');
    });

    it('ignores malformed headers (no colon)', () => {
      const { options } = parse('http://localhost:3000/mcp', '-H', 'malformed');
      expect(Object.keys(options.headers)).toHaveLength(0);
    });

    it('parses --auth option and sets Authorization header', () => {
      const { options } = parse('http://localhost:3000/mcp', '--auth', 'Bearer my-token');
      expect(options.headers['Authorization']).toBe('Bearer my-token');
      expect(options.auth).toBe('Bearer my-token');
    });
  });

  it('parses --skip-content flag', () => {
    const { options } = parse('http://localhost:3000/mcp', '--skip-content');
    expect(options.skipContent).toBe(true);
  });
});

describe('toValidatorConfig', () => {
  const baseOptions: CLIOptions = {
    format: 'text',
    verbose: false,
    quiet: false,
    tools: ['tool1'],
    skipExecution: true,
    skipContent: false,
    timeout: 10000,
    noColor: false,
    headers: {},
    execute: false,
    executeSafe: false,
    standard: 'openai',
  };

  it('maps CLIOptions to ValidatorConfig', () => {
    const config = toValidatorConfig(baseOptions);
    expect(config).toEqual({
      toolFilter: ['tool1'],
      skipExecution: true,
      executeSafeOnly: false,
      skipContent: false,
      timeout: 10000,
      verbose: false,
    });
  });

  it('maps executeSafe to executeSafeOnly', () => {
    const options = { ...baseOptions, executeSafe: true };
    const config = toValidatorConfig(options);
    expect(config.executeSafeOnly).toBe(true);
  });
});
