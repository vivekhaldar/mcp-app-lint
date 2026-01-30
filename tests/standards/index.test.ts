import { describe, it, expect } from 'vitest';
import { getStandard, getStandardNames, OPENAI_STANDARD, MCP_APPS_STANDARD, STANDARDS } from '../../src/standards/index.js';

describe('getStandard', () => {
  it('returns OpenAI standard for "openai"', () => {
    const spec = getStandard('openai');
    expect(spec).toBe(OPENAI_STANDARD);
    expect(spec?.name).toBe('openai');
  });

  it('returns MCP Apps standard for "mcp-apps"', () => {
    const spec = getStandard('mcp-apps');
    expect(spec).toBe(MCP_APPS_STANDARD);
    expect(spec?.name).toBe('mcp-apps');
  });

  it('returns undefined for unknown standard', () => {
    expect(getStandard('unknown')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getStandard('')).toBeUndefined();
  });

  it('is case-sensitive', () => {
    expect(getStandard('OpenAI')).toBeUndefined();
    expect(getStandard('MCP-Apps')).toBeUndefined();
  });
});

describe('getStandardNames', () => {
  it('returns array of available standard names', () => {
    const names = getStandardNames();
    expect(names).toContain('openai');
    expect(names).toContain('mcp-apps');
    expect(names).toHaveLength(2);
  });
});

describe('OPENAI_STANDARD', () => {
  it('has correct widget URI scheme', () => {
    expect(OPENAI_STANDARD.widgetUriScheme).toBe('ui://widget/');
  });

  it('has correct MIME type', () => {
    expect(OPENAI_STANDARD.widgetMimeType).toBe('text/html+skybridge');
  });

  it('widget pattern matches ui://widget/ URIs', () => {
    expect(OPENAI_STANDARD.widgetUriPattern.test('ui://widget/foo.html')).toBe(true);
    expect(OPENAI_STANDARD.widgetUriPattern.test('ui://other.html')).toBe(false);
  });

  it('uses snake_case CSP fields', () => {
    expect(OPENAI_STANDARD.cspFields.connectDomains).toBe('connect_domains');
    expect(OPENAI_STANDARD.cspFields.frameDomains).toBe('frame_domains');
  });

  it('has no permissions support', () => {
    expect(OPENAI_STANDARD.hasPermissions).toBe(false);
    expect(OPENAI_STANDARD.permissionsPath).toBe('');
  });
});

describe('MCP_APPS_STANDARD', () => {
  it('has correct widget URI scheme', () => {
    expect(MCP_APPS_STANDARD.widgetUriScheme).toBe('ui://');
  });

  it('has correct MIME type', () => {
    expect(MCP_APPS_STANDARD.widgetMimeType).toBe('text/html;profile=mcp-app');
  });

  it('widget pattern matches ui:// URIs', () => {
    expect(MCP_APPS_STANDARD.widgetUriPattern.test('ui://app.html')).toBe(true);
    expect(MCP_APPS_STANDARD.widgetUriPattern.test('http://example.com')).toBe(false);
  });

  it('uses camelCase CSP fields', () => {
    expect(MCP_APPS_STANDARD.cspFields.connectDomains).toBe('connectDomains');
    expect(MCP_APPS_STANDARD.cspFields.frameDomains).toBe('frameDomains');
  });

  it('has permissions support', () => {
    expect(MCP_APPS_STANDARD.hasPermissions).toBe(true);
    expect(MCP_APPS_STANDARD.permissionsPath).toBe('_meta.ui.permissions');
  });

  it('has empty string for unsupported tool meta fields', () => {
    expect(MCP_APPS_STANDARD.toolMeta.widgetAccessible).toBe('');
    expect(MCP_APPS_STANDARD.toolMeta.toolInvocation).toBe('');
    expect(MCP_APPS_STANDARD.toolMeta.fileParams).toBe('');
  });
});
