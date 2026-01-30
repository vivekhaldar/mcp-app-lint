import { describe, it, expect } from 'vitest';
import { ExecutionValidator } from '../../src/validators/execution.js';
import type { ValidationContext, ValidatorConfig } from '../../src/validators/index.js';
import { OPENAI_STANDARD } from '../../src/standards/openai.js';

const defaultConfig: ValidatorConfig = {
  toolFilter: [],
  skipExecution: false,
  executeSafeOnly: false,
  skipContent: true,
  timeout: 5000,
  verbose: false,
};

function makeCtx(client: any, overrides: Partial<ValidationContext> = {}): ValidationContext {
  return { client, config: defaultConfig, serverInfo: { name: 'test' }, ...overrides };
}

describe('ExecutionValidator', () => {
  const validator = new ExecutionValidator(OPENAI_STANDARD);

  it('skips when skipExecution is true', async () => {
    const config = { ...defaultConfig, skipExecution: true };
    const ctx: ValidationContext = { client: {} as any, config, serverInfo: { name: 'test' } };
    const results = await validator.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('EXEC_SKIP');
    expect(results[0].passed).toBe(true);
  });

  it('fails when no tools available', async () => {
    const ctx = makeCtx({}, { tools: [] });
    const results = await validator.run(ctx);
    expect(results[0].id).toBe('EXEC_001');
    expect(results[0].passed).toBe(false);
  });

  it('fails when tools is undefined', async () => {
    const ctx = makeCtx({}, { tools: undefined });
    const results = await validator.run(ctx);
    expect(results[0].id).toBe('EXEC_001');
    expect(results[0].passed).toBe(false);
  });

  it('calls each tool and validates responses', async () => {
    const tool = { name: 'my_tool', annotations: {} };
    const client = {
      callTool: async () => ({
        content: [{ type: 'text', text: 'hello' }],
        structuredContent: { key: 'value' },
        _meta: { foo: 'bar' },
        isError: false,
      }),
    };
    const ctx = makeCtx(client, { tools: [tool as any] });
    const results = await validator.run(ctx);

    expect(results.find(r => r.id === 'EXEC_001')!.passed).toBe(true);
    expect(results.find(r => r.id === 'EXEC_002')!.passed).toBe(true);
    expect(results.find(r => r.id === 'EXEC_003')!.passed).toBe(true);
    expect(results.find(r => r.id === 'EXEC_004')!.passed).toBe(true);
    expect(results.find(r => r.id === 'EXEC_005')!.passed).toBe(true);
    expect(results.find(r => r.id === 'EXEC_006')!.passed).toBe(true);
    expect(results.find(r => r.id === 'EXEC_007')!.passed).toBe(true);
  });

  it('stores tool responses on context', async () => {
    const tool = { name: 'my_tool', annotations: {} };
    const response = { content: [], isError: false };
    const client = { callTool: async () => response };
    const ctx = makeCtx(client, { tools: [tool as any] });
    await validator.run(ctx);
    expect(ctx.toolResponses).toBeDefined();
    expect(ctx.toolResponses!.has('my_tool')).toBe(true);
  });

  it('fails EXEC_001 when tool call returns isError', async () => {
    const tool = { name: 'my_tool', annotations: {} };
    const client = { callTool: async () => ({ content: [], isError: true }) };
    const ctx = makeCtx(client, { tools: [tool as any] });
    const results = await validator.run(ctx);
    const exec001 = results.find(r => r.id === 'EXEC_001');
    expect(exec001!.passed).toBe(false);
  });

  it('fails EXEC_001 when tool call throws', async () => {
    const tool = { name: 'my_tool', annotations: {} };
    const client = { callTool: async () => { throw new Error('timeout'); } };
    const ctx = makeCtx(client, { tools: [tool as any] });
    const results = await validator.run(ctx);
    const exec001 = results.find(r => r.id === 'EXEC_001');
    expect(exec001!.passed).toBe(false);
    expect(exec001!.message).toContain('timeout');
  });

  it('fails EXEC_003 when structuredContent is empty', async () => {
    const tool = { name: 'my_tool', annotations: {} };
    const client = { callTool: async () => ({ structuredContent: {}, isError: false }) };
    const ctx = makeCtx(client, { tools: [tool as any] });
    const results = await validator.run(ctx);
    const exec003 = results.find(r => r.id === 'EXEC_003');
    expect(exec003!.passed).toBe(false);
  });

  it('fails EXEC_007 when no response data at all', async () => {
    const tool = { name: 'my_tool', annotations: {} };
    const client = { callTool: async () => ({ isError: false }) };
    const ctx = makeCtx(client, { tools: [tool as any] });
    const results = await validator.run(ctx);
    const exec007 = results.find(r => r.id === 'EXEC_007');
    expect(exec007!.passed).toBe(false);
    expect(exec007!.suggestion).toBeDefined();
  });

  it('applies tool filter', async () => {
    const tools = [
      { name: 'keep', annotations: {} },
      { name: 'skip', annotations: {} },
    ];
    const calls: string[] = [];
    const client = { callTool: async (name: string) => { calls.push(name); return { content: [], isError: false }; } };
    const config = { ...defaultConfig, toolFilter: ['keep'] };
    const ctx: ValidationContext = { client: client as any, config, serverInfo: { name: 'test' }, tools: tools as any[] };
    await validator.run(ctx);
    expect(calls).toEqual(['keep']);
  });

  describe('executeSafeOnly mode', () => {
    it('skips tools without readOnlyHint=true', async () => {
      const tools = [
        { name: 'unsafe', annotations: {} },
        { name: 'safe', annotations: { readOnlyHint: true } },
      ];
      const calls: string[] = [];
      const client = { callTool: async (name: string) => { calls.push(name); return { content: [], isError: false }; } };
      const config = { ...defaultConfig, executeSafeOnly: true };
      const ctx: ValidationContext = { client: client as any, config, serverInfo: { name: 'test' }, tools: tools as any[] };
      const results = await validator.run(ctx);
      expect(calls).toEqual(['safe']);
      const skipResult = results.find(r => r.id === 'EXEC_SKIP_UNSAFE');
      expect(skipResult).toBeDefined();
      expect(skipResult!.target).toBe('unsafe');
    });

    it('skips tools with readOnlyHint=false', async () => {
      const tools = [{ name: 'tool', annotations: { readOnlyHint: false } }];
      const calls: string[] = [];
      const client = { callTool: async (name: string) => { calls.push(name); return { content: [], isError: false }; } };
      const config = { ...defaultConfig, executeSafeOnly: true };
      const ctx: ValidationContext = { client: client as any, config, serverInfo: { name: 'test' }, tools: tools as any[] };
      await validator.run(ctx);
      expect(calls).toEqual([]);
    });

    it('skips tools with no annotations', async () => {
      const tools = [{ name: 'tool' }];
      const calls: string[] = [];
      const client = { callTool: async (name: string) => { calls.push(name); return { content: [], isError: false }; } };
      const config = { ...defaultConfig, executeSafeOnly: true };
      const ctx: ValidationContext = { client: client as any, config, serverInfo: { name: 'test' }, tools: tools as any[] };
      await validator.run(ctx);
      expect(calls).toEqual([]);
    });
  });

  it('EXEC_005 not produced when content has no text items', async () => {
    const tool = { name: 'my_tool', annotations: {} };
    const client = {
      callTool: async () => ({
        content: [{ type: 'image', data: 'abc' }],
        isError: false,
      }),
    };
    const ctx = makeCtx(client, { tools: [tool as any] });
    const results = await validator.run(ctx);
    const exec005 = results.find(r => r.id === 'EXEC_005');
    expect(exec005).toBeUndefined();
  });

  it('EXEC_004 not produced when content is undefined', async () => {
    const tool = { name: 'my_tool', annotations: {} };
    const client = {
      callTool: async () => ({
        structuredContent: { key: 'val' },
        isError: false,
      }),
    };
    const ctx = makeCtx(client, { tools: [tool as any] });
    const results = await validator.run(ctx);
    const exec004 = results.find(r => r.id === 'EXEC_004');
    expect(exec004).toBeUndefined();
  });
});
