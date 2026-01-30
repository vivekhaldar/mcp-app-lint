import { describe, it, expect } from 'vitest';
import { groupByCategory, escapeXml } from '../../src/reporters/utils.js';
import type { CheckResult } from '../../src/types/check.js';

function makeCheck(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    id: 'TEST_001',
    category: 'protocol',
    severity: 'error',
    passed: true,
    message: 'Test check',
    ...overrides,
  };
}

describe('groupByCategory', () => {
  it('returns empty object for empty array', () => {
    expect(groupByCategory([])).toEqual({});
  });

  it('groups checks by category', () => {
    const checks = [
      makeCheck({ category: 'protocol', id: 'A' }),
      makeCheck({ category: 'tools', id: 'B' }),
      makeCheck({ category: 'protocol', id: 'C' }),
    ];
    const groups = groupByCategory(checks);
    expect(Object.keys(groups)).toEqual(['protocol', 'tools']);
    expect(groups['protocol']).toHaveLength(2);
    expect(groups['tools']).toHaveLength(1);
  });

  it('preserves check order within groups', () => {
    const checks = [
      makeCheck({ category: 'protocol', id: 'FIRST' }),
      makeCheck({ category: 'protocol', id: 'SECOND' }),
    ];
    const groups = groupByCategory(checks);
    expect(groups['protocol'][0].id).toBe('FIRST');
    expect(groups['protocol'][1].id).toBe('SECOND');
  });

  it('handles all category types', () => {
    const categories = ['protocol', 'tools', 'resources', 'execution', 'content', 'cross'] as const;
    const checks = categories.map(c => makeCheck({ category: c }));
    const groups = groupByCategory(checks);
    expect(Object.keys(groups)).toHaveLength(6);
  });
});

describe('escapeXml', () => {
  it('escapes ampersand', () => {
    expect(escapeXml('a&b')).toBe('a&amp;b');
  });

  it('escapes less than', () => {
    expect(escapeXml('a<b')).toBe('a&lt;b');
  });

  it('escapes greater than', () => {
    expect(escapeXml('a>b')).toBe('a&gt;b');
  });

  it('escapes double quote', () => {
    expect(escapeXml('a"b')).toBe('a&quot;b');
  });

  it('escapes single quote', () => {
    expect(escapeXml("a'b")).toBe('a&apos;b');
  });

  it('escapes all special characters at once', () => {
    expect(escapeXml('<tag attr="val" & \'x\'>')).toBe(
      '&lt;tag attr=&quot;val&quot; &amp; &apos;x&apos;&gt;'
    );
  });

  it('returns empty string unchanged', () => {
    expect(escapeXml('')).toBe('');
  });

  it('returns safe string unchanged', () => {
    expect(escapeXml('hello world 123')).toBe('hello world 123');
  });

  it('handles already-escaped content (double escaping)', () => {
    expect(escapeXml('&amp;')).toBe('&amp;amp;');
  });
});
