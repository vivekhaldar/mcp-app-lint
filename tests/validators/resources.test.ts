import { describe, it, expect } from 'vitest';
import { ResourceValidator } from '../../src/validators/resources.js';
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

function makeWidgetResource(overrides: Record<string, unknown> = {}) {
  return {
    uri: 'ui://widget/my-widget.html',
    name: 'My Widget',
    description: 'A test widget',
    mimeType: 'text/html+skybridge',
    _meta: {
      'openai/widgetDescription': 'Widget description',
      'openai/widgetPrefersBorder': true,
      'openai/widgetCSP': {
        connect_domains: ['example.com'],
      },
    },
    ...overrides,
  };
}

describe('ResourceValidator', () => {
  const validator = new ResourceValidator(OPENAI_STANDARD);

  it('fails RES_001 when serverInfo is missing', async () => {
    const ctx = makeCtx({}, { serverInfo: undefined });
    const results = await validator.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('RES_001');
    expect(results[0].passed).toBe(false);
  });

  it('fails RES_001 when listResources throws', async () => {
    const client = { listResources: async () => { throw new Error('fail'); } };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);
    expect(results[0].id).toBe('RES_001');
    expect(results[0].passed).toBe(false);
  });

  it('passes RES_001 and stores resources on context', async () => {
    const raw = makeWidgetResource();
    const resource = { uri: raw.uri, name: raw.name, description: raw.description, mimeType: raw.mimeType, raw };
    const client = { listResources: async () => [resource] };
    const ctx = makeCtx(client);
    const results = await validator.run(ctx);
    const res001 = results.find(r => r.id === 'RES_001');
    expect(res001!.passed).toBe(true);
    expect(ctx.resources).toHaveLength(1);
  });

  describe('widget resource checks', () => {
    async function runWithResource(raw: Record<string, unknown>) {
      const resource = {
        uri: raw.uri as string,
        name: raw.name as string | undefined,
        description: raw.description as string | undefined,
        mimeType: raw.mimeType as string | undefined,
        raw,
      };
      const client = { listResources: async () => [resource] };
      const ctx = makeCtx(client);
      return validator.run(ctx);
    }

    it('RES_002: passes for widget URI', async () => {
      const results = await runWithResource(makeWidgetResource());
      const check = results.find(r => r.id === 'RES_002');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it('RES_002: not produced for non-widget URI', async () => {
      const results = await runWithResource(makeWidgetResource({ uri: 'http://example.com' }));
      const check = results.find(r => r.id === 'RES_002');
      expect(check).toBeUndefined();
    });

    it('RES_003: passes when MIME type matches', async () => {
      const results = await runWithResource(makeWidgetResource());
      const check = results.find(r => r.id === 'RES_003');
      expect(check!.passed).toBe(true);
    });

    it('RES_003: fails when MIME type is wrong', async () => {
      const results = await runWithResource(makeWidgetResource({ mimeType: 'text/html' }));
      const check = results.find(r => r.id === 'RES_003');
      expect(check!.passed).toBe(false);
      expect(check!.severity).toBe('error');
    });

    it('RES_004: passes when name is present and non-empty', async () => {
      const results = await runWithResource(makeWidgetResource());
      const check = results.find(r => r.id === 'RES_004');
      expect(check!.passed).toBe(true);
    });

    it('RES_004: fails when name is empty', async () => {
      const results = await runWithResource(makeWidgetResource({ name: '' }));
      const check = results.find(r => r.id === 'RES_004');
      expect(check!.passed).toBe(false);
    });

    it('RES_004: fails when name is undefined', async () => {
      const results = await runWithResource(makeWidgetResource({ name: undefined }));
      const check = results.find(r => r.id === 'RES_004');
      expect(check!.passed).toBe(false);
    });

    it('RES_005: passes when description present', async () => {
      const results = await runWithResource(makeWidgetResource());
      const check = results.find(r => r.id === 'RES_005');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it('RES_005: not produced when description missing', async () => {
      const results = await runWithResource(makeWidgetResource({ description: undefined }));
      const check = results.find(r => r.id === 'RES_005');
      expect(check).toBeUndefined();
    });

    it('RES_006: passes when widgetDescription is present', async () => {
      const results = await runWithResource(makeWidgetResource());
      const check = results.find(r => r.id === 'RES_006');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it('RES_007: passes when widgetPrefersBorder is present', async () => {
      const results = await runWithResource(makeWidgetResource());
      const check = results.find(r => r.id === 'RES_007');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it('RES_008: passes when CSP is present', async () => {
      const results = await runWithResource(makeWidgetResource());
      const check = results.find(r => r.id === 'RES_008');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it('RES_009: warns when frame_domains is set', async () => {
      const results = await runWithResource(makeWidgetResource({
        _meta: {
          'openai/widgetCSP': {
            connect_domains: ['example.com'],
            frame_domains: ['example.com'],
          },
        },
      }));
      const check = results.find(r => r.id === 'RES_009');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(false);
      expect(check!.severity).toBe('warn');
    });

    it('RES_009: not produced when frame_domains is empty array', async () => {
      const results = await runWithResource(makeWidgetResource({
        _meta: {
          'openai/widgetCSP': {
            connect_domains: ['example.com'],
            frame_domains: [],
          },
        },
      }));
      const check = results.find(r => r.id === 'RES_009');
      expect(check).toBeUndefined();
    });
  });

  describe('MCP Apps standard', () => {
    const mcpValidator = new ResourceValidator(MCP_APPS_STANDARD);

    it('validates MCP Apps MIME type', async () => {
      const raw = {
        uri: 'ui://my-app.html',
        name: 'My App',
        mimeType: 'text/html;profile=mcp-app',
        _meta: { ui: { description: 'desc' } },
      };
      const resource = { uri: raw.uri, name: raw.name, mimeType: raw.mimeType, raw };
      const client = { listResources: async () => [resource] };
      const ctx = makeCtx(client);
      const results = await mcpValidator.run(ctx);

      const res003 = results.find(r => r.id === 'RES_003');
      expect(res003!.passed).toBe(true);
    });

    it('warns on frameDomains in MCP Apps CSP (camelCase)', async () => {
      const raw = {
        uri: 'ui://my-app.html',
        name: 'My App',
        mimeType: 'text/html;profile=mcp-app',
        _meta: { ui: { csp: { frameDomains: ['example.com'] } } },
      };
      const resource = { uri: raw.uri, name: raw.name, mimeType: raw.mimeType, raw };
      const client = { listResources: async () => [resource] };
      const ctx = makeCtx(client);
      const results = await mcpValidator.run(ctx);

      const res009 = results.find(r => r.id === 'RES_009');
      expect(res009).toBeDefined();
      expect(res009!.passed).toBe(false);
    });
  });
});
