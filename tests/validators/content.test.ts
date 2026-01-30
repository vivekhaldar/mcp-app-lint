import { describe, it, expect } from 'vitest';
import { ContentValidator } from '../../src/validators/content.js';
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

function makeCtx(client: any, overrides: Partial<ValidationContext> = {}): ValidationContext {
  return { client, config: defaultConfig, serverInfo: { name: 'test' }, ...overrides };
}

const VALID_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Widget</title>
</head>
<body>
  <h1>Hello</h1>
</body>
</html>`;

const MINIMAL_HTML = `<div>Hello</div>`;

const HTML_WITH_BLOCKED_APIS = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Test</title></head>
<body>
<script>
  window.alert('hello');
  navigator.clipboard.writeText('copy');
</script>
</body>
</html>`;

describe('ContentValidator', () => {
  const validator = new ContentValidator(OPENAI_STANDARD);

  it('skips when skipContent is true', async () => {
    const config = { ...defaultConfig, skipContent: true };
    const ctx: ValidationContext = { client: {} as any, config, serverInfo: { name: 'test' } };
    const results = await validator.run(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('READ_SKIP');
    expect(results[0].passed).toBe(true);
  });

  it('returns empty results when no resources', async () => {
    const ctx = makeCtx({}, { resources: [] });
    const results = await validator.run(ctx);
    expect(results).toEqual([]);
  });

  it('returns empty results when resources is undefined', async () => {
    const ctx = makeCtx({}, { resources: undefined });
    const results = await validator.run(ctx);
    expect(results).toEqual([]);
  });

  it('only validates widget resources', async () => {
    const resources = [
      { uri: 'http://example.com/api', name: 'API', raw: {} },
      { uri: 'ui://widget/my-widget.html', name: 'Widget', raw: {} },
    ];
    const client = {
      readResource: async () => ({ uri: 'ui://widget/my-widget.html', text: VALID_HTML }),
    };
    const ctx = makeCtx(client, { resources: resources as any[] });
    const results = await validator.run(ctx);
    // Should only have checks for the widget resource
    const targets = results.filter(r => r.target).map(r => r.target);
    expect(targets).not.toContain('http://example.com/api');
  });

  describe('widget HTML validation', () => {
    async function runWithHTML(html: string) {
      const resources = [{ uri: 'ui://widget/test.html', name: 'Test', raw: {} }];
      const client = {
        readResource: async () => ({ uri: 'ui://widget/test.html', text: html }),
      };
      const ctx = makeCtx(client, { resources: resources as any[] });
      return validator.run(ctx);
    }

    it('READ_001: passes when resource is readable', async () => {
      const results = await runWithHTML(VALID_HTML);
      const check = results.find(r => r.id === 'READ_001');
      expect(check!.passed).toBe(true);
    });

    it('READ_001: fails when readResource throws', async () => {
      const resources = [{ uri: 'ui://widget/test.html', name: 'Test', raw: {} }];
      const client = {
        readResource: async () => { throw new Error('not found'); },
      };
      const ctx = makeCtx(client, { resources: resources as any[] });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'READ_001');
      expect(check!.passed).toBe(false);
      expect(check!.message).toContain('not found');
    });

    it('READ_002: passes when content exists', async () => {
      const results = await runWithHTML(VALID_HTML);
      const check = results.find(r => r.id === 'READ_002');
      expect(check!.passed).toBe(true);
    });

    it('READ_003: passes when text content present', async () => {
      const results = await runWithHTML(VALID_HTML);
      const check = results.find(r => r.id === 'READ_003');
      expect(check!.passed).toBe(true);
    });

    it('READ_003: fails when both text and blob are missing', async () => {
      const resources = [{ uri: 'ui://widget/test.html', name: 'Test', raw: {} }];
      const client = {
        readResource: async () => ({ uri: 'ui://widget/test.html' }),
      };
      const ctx = makeCtx(client, { resources: resources as any[] });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'READ_003');
      expect(check!.passed).toBe(false);
    });

    it('READ_003: passes with blob content', async () => {
      const resources = [{ uri: 'ui://widget/test.html', name: 'Test', raw: {} }];
      const html = '<html><head><meta charset="utf-8"><title>Test</title></head><body>Hello</body></html>';
      const blob = Buffer.from(html).toString('base64');
      const client = {
        readResource: async () => ({ uri: 'ui://widget/test.html', blob }),
      };
      const ctx = makeCtx(client, { resources: resources as any[] });
      const results = await validator.run(ctx);
      const check = results.find(r => r.id === 'READ_003');
      expect(check!.passed).toBe(true);
    });

    it('READ_004: passes for valid HTML', async () => {
      const results = await runWithHTML(VALID_HTML);
      const check = results.find(r => r.id === 'READ_004');
      expect(check!.passed).toBe(true);
    });

    it('READ_005: passes when meta charset present', async () => {
      const results = await runWithHTML(VALID_HTML);
      const check = results.find(r => r.id === 'READ_005');
      expect(check!.passed).toBe(true);
    });

    it('READ_005: fails when meta charset missing', async () => {
      const results = await runWithHTML(MINIMAL_HTML);
      const check = results.find(r => r.id === 'READ_005');
      expect(check!.passed).toBe(false);
    });

    it('READ_005: passes with http-equiv content-type', async () => {
      const html = '<html><head><meta http-equiv="content-type" content="text/html; charset=utf-8"><title>Test</title></head><body></body></html>';
      const results = await runWithHTML(html);
      const check = results.find(r => r.id === 'READ_005');
      expect(check!.passed).toBe(true);
    });

    it('READ_006: passes when title present', async () => {
      const results = await runWithHTML(VALID_HTML);
      const check = results.find(r => r.id === 'READ_006');
      expect(check!.passed).toBe(true);
    });

    it('READ_006: fails when title missing', async () => {
      const results = await runWithHTML(MINIMAL_HTML);
      const check = results.find(r => r.id === 'READ_006');
      expect(check!.passed).toBe(false);
    });

    it('READ_006: fails when title is empty (whitespace only)', async () => {
      const html = '<html><head><meta charset="utf-8"><title>   </title></head><body></body></html>';
      const results = await runWithHTML(html);
      const check = results.find(r => r.id === 'READ_006');
      expect(check!.passed).toBe(false);
    });

    it('READ_007: passes when no blocked APIs found', async () => {
      const results = await runWithHTML(VALID_HTML);
      const check = results.find(r => r.id === 'READ_007');
      expect(check!.passed).toBe(true);
    });

    it('READ_007: fails when blocked APIs found', async () => {
      const results = await runWithHTML(HTML_WITH_BLOCKED_APIS);
      const check = results.find(r => r.id === 'READ_007');
      expect(check!.passed).toBe(false);
      expect(check!.message).toContain('window.alert');
      expect(check!.message).toContain('navigator.clipboard');
    });

    it('READ_007: detects window.prompt', async () => {
      const html = '<script>window.prompt("enter")</script>';
      const results = await runWithHTML(html);
      const check = results.find(r => r.id === 'READ_007');
      expect(check!.passed).toBe(false);
      expect(check!.message).toContain('window.prompt');
    });

    it('READ_007: detects window.confirm', async () => {
      const html = '<script>window.confirm("sure?")</script>';
      const results = await runWithHTML(html);
      const check = results.find(r => r.id === 'READ_007');
      expect(check!.passed).toBe(false);
    });
  });

  it('stores resource contents on context', async () => {
    const resources = [{ uri: 'ui://widget/test.html', name: 'Test', raw: {} }];
    const client = {
      readResource: async () => ({ uri: 'ui://widget/test.html', text: VALID_HTML }),
    };
    const ctx = makeCtx(client, { resources: resources as any[] });
    await validator.run(ctx);
    expect(ctx.resourceContents).toBeDefined();
    expect(ctx.resourceContents!.has('ui://widget/test.html')).toBe(true);
  });
});
