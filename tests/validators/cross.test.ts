import { describe, it, expect } from 'vitest';
import { CrossValidator } from '../../src/validators/cross.js';
import type { ValidationContext, ValidatorConfig } from '../../src/validators/index.js';
import { OPENAI_STANDARD } from '../../src/standards/openai.js';

const defaultConfig: ValidatorConfig = {
  toolFilter: [],
  skipExecution: true,
  executeSafeOnly: false,
  skipContent: false,
  timeout: 5000,
  verbose: false,
};

function makeCtx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return { client: {} as any, config: defaultConfig, serverInfo: { name: 'test' }, ...overrides };
}

describe('CrossValidator', () => {
  const validator = new CrossValidator(OPENAI_STANDARD);

  it('returns empty results when tools are missing', async () => {
    const ctx = makeCtx({ tools: undefined, resources: [] });
    const results = await validator.run(ctx);
    expect(results).toEqual([]);
  });

  it('returns empty results when resources are missing', async () => {
    const ctx = makeCtx({ tools: [], resources: undefined });
    const results = await validator.run(ctx);
    expect(results).toEqual([]);
  });

  it('returns empty results when both missing', async () => {
    const ctx = makeCtx({ tools: undefined, resources: undefined });
    const results = await validator.run(ctx);
    expect(results).toEqual([]);
  });

  describe('XVAL_001: outputTemplate exists in resources', () => {
    it('passes when outputTemplate URI is in resources', async () => {
      const tools = [{
        name: 'my_tool',
        raw: { _meta: { 'openai/outputTemplate': 'ui://widget/my-widget.html' } },
      }];
      const resources = [{ uri: 'ui://widget/my-widget.html', raw: {} }];
      const ctx = makeCtx({ tools: tools as any[], resources: resources as any[] });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'XVAL_001');
      expect(check!.passed).toBe(true);
    });

    it('fails when outputTemplate URI is not in resources', async () => {
      const tools = [{
        name: 'my_tool',
        raw: { _meta: { 'openai/outputTemplate': 'ui://widget/missing.html' } },
      }];
      const resources = [{ uri: 'ui://widget/other.html', raw: {} }];
      const ctx = makeCtx({ tools: tools as any[], resources: resources as any[] });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'XVAL_001');
      expect(check!.passed).toBe(false);
      expect(check!.suggestion).toBeDefined();
    });

    it('skips when tool has no outputTemplate', async () => {
      const tools = [{ name: 'my_tool', raw: { _meta: {} } }];
      const resources = [{ uri: 'ui://widget/my-widget.html', raw: {} }];
      const ctx = makeCtx({ tools: tools as any[], resources: resources as any[] });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'XVAL_001');
      expect(check).toBeUndefined();
    });
  });

  describe('XVAL_002: outputTemplate resources are readable', () => {
    it('passes when resource content is available', async () => {
      const tools = [{
        name: 'my_tool',
        raw: { _meta: { 'openai/outputTemplate': 'ui://widget/my-widget.html' } },
      }];
      const resources = [{ uri: 'ui://widget/my-widget.html', raw: {} }];
      const resourceContents = new Map([['ui://widget/my-widget.html', { uri: 'ui://widget/my-widget.html', text: '<html></html>' }]]);
      const ctx = makeCtx({ tools: tools as any[], resources: resources as any[], resourceContents: resourceContents as any });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'XVAL_002');
      expect(check!.passed).toBe(true);
    });

    it('fails when resource content is not available and skipContent is false', async () => {
      const tools = [{
        name: 'my_tool',
        raw: { _meta: { 'openai/outputTemplate': 'ui://widget/my-widget.html' } },
      }];
      const resources = [{ uri: 'ui://widget/my-widget.html', raw: {} }];
      const resourceContents = new Map();
      const ctx = makeCtx({ tools: tools as any[], resources: resources as any[], resourceContents: resourceContents as any });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'XVAL_002');
      expect(check!.passed).toBe(false);
    });

    it('skips XVAL_002 when skipContent is true and content is missing', async () => {
      const config = { ...defaultConfig, skipContent: true };
      const tools = [{
        name: 'my_tool',
        raw: { _meta: { 'openai/outputTemplate': 'ui://widget/my-widget.html' } },
      }];
      const resources = [{ uri: 'ui://widget/my-widget.html', raw: {} }];
      const resourceContents = new Map();
      const ctx: ValidationContext = { client: {} as any, config, tools: tools as any[], resources: resources as any[], resourceContents: resourceContents as any };
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'XVAL_002');
      expect(check).toBeUndefined();
    });
  });

  describe('XVAL_003: Widget HTML content available', () => {
    it('passes when resourceContents has entries', async () => {
      const tools = [{
        name: 'my_tool',
        raw: { _meta: { 'openai/outputTemplate': 'ui://widget/my-widget.html' } },
      }];
      const resources = [{ uri: 'ui://widget/my-widget.html', raw: {} }];
      const resourceContents = new Map([['ui://widget/my-widget.html', { text: '<html></html>' }]]);
      const ctx = makeCtx({ tools: tools as any[], resources: resources as any[], resourceContents: resourceContents as any });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'XVAL_003');
      expect(check).toBeDefined();
      expect(check!.passed).toBe(true);
    });

    it('not produced when resourceContents is empty', async () => {
      const tools = [{ name: 'my_tool', raw: { _meta: {} } }];
      const resources = [{ uri: 'ui://widget/my-widget.html', raw: {} }];
      const resourceContents = new Map();
      const ctx = makeCtx({ tools: tools as any[], resources: resources as any[], resourceContents: resourceContents as any });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'XVAL_003');
      expect(check).toBeUndefined();
    });
  });

  describe('XVAL_004: Orphan widget resources', () => {
    it('passes when all widgets are referenced', async () => {
      const tools = [{
        name: 'my_tool',
        raw: { _meta: { 'openai/outputTemplate': 'ui://widget/my-widget.html' } },
      }];
      const resources = [{ uri: 'ui://widget/my-widget.html', raw: {} }];
      const ctx = makeCtx({ tools: tools as any[], resources: resources as any[] });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'XVAL_004');
      expect(check!.passed).toBe(true);
    });

    it('fails for orphan widget resources', async () => {
      const tools = [{ name: 'my_tool', raw: { _meta: {} } }];
      const resources = [{ uri: 'ui://widget/orphan.html', raw: {} }];
      const ctx = makeCtx({ tools: tools as any[], resources: resources as any[] });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'XVAL_004');
      expect(check!.passed).toBe(false);
      expect(check!.target).toBe('ui://widget/orphan.html');
    });

    it('ignores non-widget resources for orphan check', async () => {
      const tools = [{ name: 'my_tool', raw: { _meta: {} } }];
      const resources = [{ uri: 'http://example.com/data.json', raw: {} }];
      const ctx = makeCtx({ tools: tools as any[], resources: resources as any[] });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'XVAL_004');
      // Non-widget resources don't trigger orphan check failure
      expect(check!.passed).toBe(true);
    });
  });
});
