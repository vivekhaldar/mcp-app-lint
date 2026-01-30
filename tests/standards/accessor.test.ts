import { describe, it, expect } from 'vitest';
import { getPath } from '../../src/standards/accessor.js';

describe('getPath', () => {
  it('returns undefined for empty path', () => {
    expect(getPath({ a: 1 }, '')).toBeUndefined();
  });

  it('returns undefined for null input', () => {
    expect(getPath(null, 'a')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(getPath(undefined, 'a')).toBeUndefined();
  });

  it('returns undefined for non-object input', () => {
    expect(getPath('string', 'a')).toBeUndefined();
    expect(getPath(42, 'a')).toBeUndefined();
    expect(getPath(true, 'a')).toBeUndefined();
  });

  it('resolves single-level path', () => {
    expect(getPath({ foo: 'bar' }, 'foo')).toBe('bar');
  });

  it('resolves multi-level dotted path', () => {
    expect(getPath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
  });

  it('returns undefined for non-existent path', () => {
    expect(getPath({ a: 1 }, 'b')).toBeUndefined();
  });

  it('returns undefined when traversing through a primitive', () => {
    expect(getPath({ a: 'string' }, 'a.b')).toBeUndefined();
  });

  it('returns undefined when traversing through null', () => {
    expect(getPath({ a: null }, 'a.b')).toBeUndefined();
  });

  it('handles keys with slashes (OpenAI metadata paths)', () => {
    const obj = { _meta: { 'openai/outputTemplate': 'ui://widget/foo.html' } };
    expect(getPath(obj, '_meta.openai/outputTemplate')).toBe('ui://widget/foo.html');
  });

  it('handles deeply nested MCP Apps paths', () => {
    const obj = { _meta: { ui: { resourceUri: 'ui://app.html' } } };
    expect(getPath(obj, '_meta.ui.resourceUri')).toBe('ui://app.html');
  });

  it('returns the value even if it is falsy (0, false, empty string)', () => {
    expect(getPath({ a: 0 }, 'a')).toBe(0);
    expect(getPath({ a: false }, 'a')).toBe(false);
    expect(getPath({ a: '' }, 'a')).toBe('');
  });

  it('returns objects and arrays as values', () => {
    const nested = { x: 1 };
    expect(getPath({ a: nested }, 'a')).toBe(nested);
    const arr = [1, 2, 3];
    expect(getPath({ a: arr }, 'a')).toBe(arr);
  });
});
