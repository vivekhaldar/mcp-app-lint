import { describe, it, expect } from 'vitest';
import { runValidationPipeline } from '../../src/validators/index.js';
import type { ValidationContext, ValidatorConfig } from '../../src/validators/index.js';
import { Validator } from '../../src/validators/base.js';
import type { CheckResult, Category } from '../../src/types/check.js';
import { OPENAI_STANDARD } from '../../src/standards/openai.js';
import { MockMCPClient } from '../fixtures/mock-server/server.js';

const defaultConfig: ValidatorConfig = {
  toolFilter: [],
  skipExecution: true,
  executeSafeOnly: false,
  skipContent: true,
  timeout: 5000,
  verbose: false,
};

class StubValidator extends Validator {
  name: string;
  category: Category;
  private results: CheckResult[];

  constructor(name: string, category: Category, results: CheckResult[]) {
    super(OPENAI_STANDARD);
    this.name = name;
    this.category = category;
    this.results = results;
  }

  async run(_ctx: ValidationContext): Promise<CheckResult[]> {
    return this.results;
  }
}

describe('runValidationPipeline', () => {
  it('returns empty results with no validators', async () => {
    const client = new MockMCPClient() as any;
    const results = await runValidationPipeline(client, defaultConfig, []);
    expect(results).toEqual([]);
  });

  it('accumulates results from multiple validators', async () => {
    const client = new MockMCPClient() as any;
    const v1 = new StubValidator('tools', 'tools', [
      { id: 'A', category: 'tools', severity: 'info', passed: true, message: 'ok' },
    ]);
    const v2 = new StubValidator('resources', 'resources', [
      { id: 'B', category: 'resources', severity: 'info', passed: true, message: 'ok' },
    ]);
    const results = await runValidationPipeline(client, defaultConfig, [v1, v2]);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('A');
    expect(results[1].id).toBe('B');
  });

  it('stops early when protocol validator has errors', async () => {
    const client = new MockMCPClient() as any;
    const proto = new StubValidator('protocol', 'protocol', [
      { id: 'CONN_001', category: 'protocol', severity: 'error', passed: false, message: 'fail' },
    ]);
    const tools = new StubValidator('tools', 'tools', [
      { id: 'TOOL_001', category: 'tools', severity: 'info', passed: true, message: 'ok' },
    ]);
    const results = await runValidationPipeline(client, defaultConfig, [proto, tools]);
    // Should only have protocol results because it failed with errors
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('CONN_001');
  });

  it('continues after protocol validator with only warnings', async () => {
    const client = new MockMCPClient() as any;
    const proto = new StubValidator('protocol', 'protocol', [
      { id: 'PROTO_002', category: 'protocol', severity: 'warn', passed: false, message: 'old version' },
    ]);
    const tools = new StubValidator('tools', 'tools', [
      { id: 'TOOL_001', category: 'tools', severity: 'info', passed: true, message: 'ok' },
    ]);
    const results = await runValidationPipeline(client, defaultConfig, [proto, tools]);
    expect(results).toHaveLength(2);
  });

  it('continues after protocol validator with all passing', async () => {
    const client = new MockMCPClient() as any;
    const proto = new StubValidator('protocol', 'protocol', [
      { id: 'CONN_001', category: 'protocol', severity: 'error', passed: true, message: 'ok' },
    ]);
    const tools = new StubValidator('tools', 'tools', [
      { id: 'TOOL_001', category: 'tools', severity: 'info', passed: true, message: 'ok' },
    ]);
    const results = await runValidationPipeline(client, defaultConfig, [proto, tools]);
    expect(results).toHaveLength(2);
  });

  it('uses provided context', async () => {
    const client = new MockMCPClient() as any;
    const ctx: ValidationContext = { client, config: defaultConfig, serverInfo: { name: 'test' } };
    const v = new StubValidator('tools', 'tools', []);
    await runValidationPipeline(client, defaultConfig, [v], ctx);
    // Context should be preserved (not replaced)
    expect(ctx.serverInfo?.name).toBe('test');
  });

  it('non-protocol validators do not trigger early exit on errors', async () => {
    const client = new MockMCPClient() as any;
    const tools = new StubValidator('tools', 'tools', [
      { id: 'TOOL_001', category: 'tools', severity: 'error', passed: false, message: 'fail' },
    ]);
    const resources = new StubValidator('resources', 'resources', [
      { id: 'RES_001', category: 'resources', severity: 'info', passed: true, message: 'ok' },
    ]);
    const results = await runValidationPipeline(client, defaultConfig, [tools, resources]);
    expect(results).toHaveLength(2);
  });
});
