import { describe, it, expect } from 'vitest';
import { ToolValidator } from '../../src/validators/tools.js';
import type { ValidationContext, ValidatorConfig } from '../../src/validators/index.js';
import { OPENAI_STANDARD } from '../../src/standards/openai.js';
import { MCP_APPS_STANDARD } from '../../src/standards/mcp-apps.js';

const defaultConfig: ValidatorConfig = {
  toolFilter: [],
  skipExecution: true,
  executeSafeOnly: false,
  skipContent: true,
  timeout: 5000,
  verbose: false,
};

function makeCtx(client: any, overrides: Partial<ValidationContext> = {}): ValidationContext {
  return { client, config: defaultConfig, serverInfo: { name: 'test' }, ...overrides };
}

function makeTool(overrides: Record<string, unknown> = {}) {
  return {
    name: 'my_tool',
    description: 'A test tool that does things',
    inputSchema: { type: 'object', properties: {} },
    _meta: {
      'openai/outputTemplate': 'ui://widget/my-widget.html',
    },
    ...overrides,
  };
}

describe('ToolValidator', () => {
  const validator = new ToolValidator(OPENAI_STANDARD);

  it('fails TOOL_001 when serverInfo is missing', async () => {
    const ctx = makeCtx({}, { serverInfo: undefined });
    const results = await validator.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('TOOL_001');
    expect(results[0].passed).toBe(false);
  });

  it('fails TOOL_001 when listTools throws', async () => {
    const client = {
      listTools: async () => { throw new Error('network error'); },
    };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);
    const tool001 = results.find(r => r.id === 'TOOL_001');
    expect(tool001).toBeDefined();
    expect(tool001!.passed).toBe(false);
    expect(tool001!.message).toContain('network error');
  });

  it('passes TOOL_001 when listTools succeeds', async () => {
    const client = {
      listTools: async () => [{ name: 'a', description: 'desc', inputSchema: { type: 'object' }, raw: makeTool() }],
    };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);
    const tool001 = results.find(r => r.id === 'TOOL_001');
    expect(tool001!.passed).toBe(true);
  });

  it('stores tools on context', async () => {
    const tool = { name: 'a', description: 'desc', inputSchema: { type: 'object' }, raw: makeTool() };
    const client = { listTools: async () => [tool] };
    const ctx = makeCtx(client);
    await validator.run(ctx);
    expect(ctx.tools).toHaveLength(1);
  });

  it('applies tool filter', async () => {
    const tools = [
      { name: 'keep', description: 'Keep this tool for real', inputSchema: { type: 'object' }, raw: makeTool({ name: 'keep' }) },
      { name: 'skip', description: 'Skip this tool for real', inputSchema: { type: 'object' }, raw: makeTool({ name: 'skip' }) },
    ];
    const client = { listTools: async () => tools };
    const config = { ...defaultConfig, toolFilter: ['keep'] };
    const ctx: ValidationContext = { client, config, serverInfo: { name: 'test' } };
    const results = await validator.run(ctx);
    // Should only have checks with target 'keep' (plus TOOL_001 for the list)
    const targets = results.filter(r => r.target).map(r => r.target);
    expect(targets).not.toContain('skip');
    expect(targets).toContain('keep');
  });

  describe('individual tool checks', () => {
    async function runWithTool(toolRaw: Record<string, unknown>) {
      const tool = {
        name: toolRaw.name as string || 'my_tool',
        description: toolRaw.description as string | undefined,
        inputSchema: toolRaw.inputSchema as Record<string, unknown> | undefined,
        annotations: toolRaw.annotations as Record<string, unknown> | undefined,
        raw: toolRaw,
      };
      const client = { listTools: async () => [tool] };
      const ctx = makeCtx(client);
      return validator.run(ctx);
    }

    it('TOOL_002: always passes for tools (has name)', async () => {
      const results = await runWithTool(makeTool());
      const check = results.find(r => r.id === 'TOOL_002');
      expect(check!.passed).toBe(true);
    });

    it('TOOL_003: passes when description present', async () => {
      const results = await runWithTool(makeTool());
      const check = results.find(r => r.id === 'TOOL_003');
      expect(check!.passed).toBe(true);
    });

    it('TOOL_003: fails when description missing', async () => {
      const results = await runWithTool(makeTool({ description: undefined }));
      const check = results.find(r => r.id === 'TOOL_003');
      expect(check!.passed).toBe(false);
    });

    it('TOOL_004: passes when description > 10 chars', async () => {
      const results = await runWithTool(makeTool({ description: 'A long enough description' }));
      const check = results.find(r => r.id === 'TOOL_004');
      expect(check!.passed).toBe(true);
    });

    it('TOOL_004: fails when description <= 10 chars', async () => {
      const results = await runWithTool(makeTool({ description: 'Short' }));
      const check = results.find(r => r.id === 'TOOL_004');
      expect(check!.passed).toBe(false);
      expect(check!.severity).toBe('warn');
    });

    it('TOOL_004: fails at exactly 10 chars', async () => {
      const results = await runWithTool(makeTool({ description: '1234567890' }));
      const check = results.find(r => r.id === 'TOOL_004');
      expect(check!.passed).toBe(false);
    });

    it('TOOL_004: passes at 11 chars', async () => {
      const results = await runWithTool(makeTool({ description: '12345678901' }));
      const check = results.find(r => r.id === 'TOOL_004');
      expect(check!.passed).toBe(true);
    });

    it('TOOL_005: passes when inputSchema present', async () => {
      const results = await runWithTool(makeTool());
      const check = results.find(r => r.id === 'TOOL_005');
      expect(check!.passed).toBe(true);
    });

    it('TOOL_005: fails when inputSchema missing', async () => {
      const results = await runWithTool(makeTool({ inputSchema: undefined }));
      const check = results.find(r => r.id === 'TOOL_005');
      expect(check!.passed).toBe(false);
    });

    it('TOOL_006: passes when inputSchema has type property', async () => {
      const results = await runWithTool(makeTool({ inputSchema: { type: 'object' } }));
      const check = results.find(r => r.id === 'TOOL_006');
      expect(check!.passed).toBe(true);
    });

    it('TOOL_006: fails when inputSchema missing type', async () => {
      const results = await runWithTool(makeTool({ inputSchema: { properties: {} } }));
      const check = results.find(r => r.id === 'TOOL_006');
      expect(check!.passed).toBe(false);
    });

    it('TOOL_007: passes when outputTemplate present', async () => {
      const results = await runWithTool(makeTool());
      const check = results.find(r => r.id === 'TOOL_007');
      expect(check!.passed).toBe(true);
    });

    it('TOOL_007: fails when outputTemplate missing', async () => {
      const results = await runWithTool(makeTool({ _meta: {} }));
      const check = results.find(r => r.id === 'TOOL_007');
      expect(check!.passed).toBe(false);
    });

    it('TOOL_008: passes when outputTemplate uses correct URI scheme', async () => {
      const results = await runWithTool(makeTool());
      const check = results.find(r => r.id === 'TOOL_008');
      expect(check!.passed).toBe(true);
    });

    it('TOOL_008: fails when outputTemplate uses wrong URI scheme', async () => {
      const results = await runWithTool(makeTool({
        _meta: { 'openai/outputTemplate': 'http://example.com/widget.html' },
      }));
      const check = results.find(r => r.id === 'TOOL_008');
      expect(check!.passed).toBe(false);
    });

    it('TOOL_009: passes when outputTemplate ends with .html', async () => {
      const results = await runWithTool(makeTool());
      const check = results.find(r => r.id === 'TOOL_009');
      expect(check!.passed).toBe(true);
    });

    it('TOOL_009: fails when outputTemplate does not end with .html', async () => {
      const results = await runWithTool(makeTool({
        _meta: { 'openai/outputTemplate': 'ui://widget/my-widget.txt' },
      }));
      const check = results.find(r => r.id === 'TOOL_009');
      expect(check!.passed).toBe(false);
    });

    it('TOOL_012: passes when title field present', async () => {
      const results = await runWithTool(makeTool({ title: 'My Tool' }));
      const check = results.find(r => r.id === 'TOOL_012');
      expect(check!.passed).toBe(true);
    });

    it('TOOL_012: fails when title missing', async () => {
      const results = await runWithTool(makeTool());
      const check = results.find(r => r.id === 'TOOL_012');
      expect(check!.passed).toBe(false);
      expect(check!.severity).toBe('info');
    });

    it('TOOL_015: passes when annotations present and non-empty', async () => {
      const results = await runWithTool(makeTool({ annotations: { readOnlyHint: true } }));
      // Need to also set annotations on the wrapper level
      const tool = {
        name: 'my_tool',
        description: 'A test tool that does things',
        inputSchema: { type: 'object', properties: {} },
        annotations: { readOnlyHint: true },
        raw: makeTool({ annotations: { readOnlyHint: true } }),
      };
      const client = { listTools: async () => [tool] };
      const ctx = makeCtx(client);
      const results2 = await validator.run(ctx);
      const check = results2.find(r => r.id === 'TOOL_015');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it('TOOL_013: passes when invoking <= 64 chars', async () => {
      const results = await runWithTool(makeTool({
        _meta: {
          'openai/outputTemplate': 'ui://widget/my-widget.html',
          'openai/toolInvocation': { invoking: 'Loading...' },
        },
      }));
      const check = results.find(r => r.id === 'TOOL_013');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it('TOOL_013: fails when invoking > 64 chars', async () => {
      const results = await runWithTool(makeTool({
        _meta: {
          'openai/outputTemplate': 'ui://widget/my-widget.html',
          'openai/toolInvocation': { invoking: 'A'.repeat(65) },
        },
      }));
      const check = results.find(r => r.id === 'TOOL_013');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
    });

    it('TOOL_014: passes when invoked <= 64 chars', async () => {
      const results = await runWithTool(makeTool({
        _meta: {
          'openai/outputTemplate': 'ui://widget/my-widget.html',
          'openai/toolInvocation': { invoked: 'Complete' },
        },
      }));
      const check = results.find(r => r.id === 'TOOL_014');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });
  });

  describe('MCP Apps standard', () => {
    const mcpValidator = new ToolValidator(MCP_APPS_STANDARD);

    it('validates against MCP Apps paths', async () => {
      const tool = {
        name: 'my_tool',
        description: 'A test tool that does things',
        inputSchema: { type: 'object' },
        raw: {
          name: 'my_tool',
          description: 'A test tool that does things',
          inputSchema: { type: 'object' },
          _meta: { ui: { resourceUri: 'ui://my-widget.html' } },
        },
      };
      const client = { listTools: async () => [tool] };
      const ctx = makeCtx(client);
      const results = await mcpValidator.run(ctx);

      const tool007 = results.find(r => r.id === 'TOOL_007');
      expect(tool007!.passed).toBe(true);

      const tool008 = results.find(r => r.id === 'TOOL_008');
      expect(tool008!.passed).toBe(true);
    });

    it('skips toolInvocation and fileParams checks (empty paths)', async () => {
      const tool = {
        name: 'my_tool',
        description: 'A test tool that does things',
        inputSchema: { type: 'object' },
        raw: {
          name: 'my_tool',
          description: 'A test tool that does things',
          inputSchema: { type: 'object' },
          _meta: { ui: { resourceUri: 'ui://my-widget.html' } },
        },
      };
      const client = { listTools: async () => [tool] };
      const ctx = makeCtx(client);
      const results = await mcpValidator.run(ctx);

      // TOOL_013/014 (toolInvocation) should not appear for MCP Apps
      expect(results.find(r => r.id === 'TOOL_013')).toBeUndefined();
      expect(results.find(r => r.id === 'TOOL_014')).toBeUndefined();
    });
  });
});
