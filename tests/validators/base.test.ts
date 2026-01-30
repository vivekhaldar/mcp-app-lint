import { describe, it, expect } from 'vitest';
import { Validator } from '../../src/validators/base.js';
import type { ValidationContext } from '../../src/validators/index.js';
import type { CheckResult, Category } from '../../src/types/check.js';
import { OPENAI_STANDARD } from '../../src/standards/openai.js';

// Concrete subclass for testing the abstract base
class TestValidator extends Validator {
  name = 'test';
  category = 'protocol' as Category;

  async run(_ctx: ValidationContext): Promise<CheckResult[]> {
    return [];
  }

  // Expose protected methods for testing
  publicGetSpecPath(obj: unknown, path: string) {
    return this.getSpecPath(obj, path);
  }

  publicHasSpecPath(obj: unknown, path: string) {
    return this.hasSpecPath(obj, path);
  }

  publicPass(id: string, message: string, opts?: Partial<CheckResult>) {
    return this.pass(id, message, opts);
  }

  publicFail(id: string, severity: CheckResult['severity'], message: string, opts?: Partial<CheckResult>) {
    return this.fail(id, severity, message, opts);
  }
}

describe('Validator base class', () => {
  const validator = new TestValidator(OPENAI_STANDARD);

  describe('getSpecPath', () => {
    it('returns undefined for empty path', () => {
      expect(validator.publicGetSpecPath({ a: 1 }, '')).toBeUndefined();
    });

    it('resolves nested path', () => {
      const obj = { _meta: { 'openai/outputTemplate': 'ui://widget/foo.html' } };
      expect(validator.publicGetSpecPath(obj, '_meta.openai/outputTemplate')).toBe('ui://widget/foo.html');
    });

    it('returns undefined for missing path', () => {
      expect(validator.publicGetSpecPath({ a: 1 }, 'b.c')).toBeUndefined();
    });
  });

  describe('hasSpecPath', () => {
    it('returns false for empty path', () => {
      expect(validator.publicHasSpecPath({ a: 1 }, '')).toBe(false);
    });

    it('returns true when path exists with truthy value', () => {
      expect(validator.publicHasSpecPath({ a: 'hello' }, 'a')).toBe(true);
    });

    it('returns false when path value is null', () => {
      expect(validator.publicHasSpecPath({ a: null }, 'a')).toBe(false);
    });

    it('returns false when path value is undefined', () => {
      expect(validator.publicHasSpecPath({ a: undefined }, 'a')).toBe(false);
    });

    it('returns true for falsy but defined values (0, false, empty string)', () => {
      expect(validator.publicHasSpecPath({ a: 0 }, 'a')).toBe(true);
      expect(validator.publicHasSpecPath({ a: false }, 'a')).toBe(true);
      expect(validator.publicHasSpecPath({ a: '' }, 'a')).toBe(true);
    });
  });

  describe('pass', () => {
    it('creates a passing check result with default severity', () => {
      const result = validator.publicPass('TEST_001', 'Test passed');
      expect(result).toEqual({
        id: 'TEST_001',
        category: 'protocol',
        severity: 'info',
        passed: true,
        message: 'Test passed',
      });
    });

    it('allows overriding severity', () => {
      const result = validator.publicPass('TEST_001', 'msg', { severity: 'error' });
      expect(result.severity).toBe('error');
      expect(result.passed).toBe(true);
    });

    it('allows adding target and details', () => {
      const result = validator.publicPass('TEST_001', 'msg', {
        target: 'myTool',
        details: { foo: 'bar' },
      });
      expect(result.target).toBe('myTool');
      expect(result.details).toEqual({ foo: 'bar' });
    });
  });

  describe('fail', () => {
    it('creates a failing check result', () => {
      const result = validator.publicFail('TEST_001', 'error', 'Test failed');
      expect(result).toEqual({
        id: 'TEST_001',
        category: 'protocol',
        severity: 'error',
        passed: false,
        message: 'Test failed',
      });
    });

    it('includes suggestion when provided', () => {
      const result = validator.publicFail('TEST_001', 'warn', 'msg', {
        suggestion: 'Fix it',
      });
      expect(result.suggestion).toBe('Fix it');
      expect(result.passed).toBe(false);
    });

    it('includes target and details', () => {
      const result = validator.publicFail('TEST_001', 'error', 'msg', {
        target: 'myTool',
        details: { key: 'val' },
      });
      expect(result.target).toBe('myTool');
      expect(result.details).toEqual({ key: 'val' });
    });
  });
});
