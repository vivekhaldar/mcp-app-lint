// ABOUTME: Base class providing common utilities for all validators.
// ABOUTME: Includes helper methods for creating check results and spec path resolution.

import type { ValidationContext } from './index.js';
import type { CheckResult, Severity, Category } from '../types/check.js';
import type { StandardSpec } from '../standards/spec.js';
import { getPath } from '../standards/accessor.js';

export abstract class Validator {
  abstract name: string;
  abstract category: Category;

  /** The standard specification being validated against */
  protected spec: StandardSpec;

  constructor(spec: StandardSpec) {
    this.spec = spec;
  }

  abstract run(ctx: ValidationContext): Promise<CheckResult[]>;

  /**
   * Get a value from an object using a spec path.
   * Returns undefined if path is empty (field not in this standard) or not found.
   */
  protected getSpecPath(obj: unknown, path: string): unknown {
    if (!path) return undefined;
    return getPath(obj, path);
  }

  /**
   * Check if a spec path exists and has a value.
   * Returns false if path is empty (field not in this standard).
   */
  protected hasSpecPath(obj: unknown, path: string): boolean {
    if (!path) return false;
    const value = getPath(obj, path);
    return value !== undefined && value !== null;
  }

  /**
   * Helper to create a passing check result
   */
  protected pass(
    id: string,
    message: string,
    opts: Partial<CheckResult> = {}
  ): CheckResult {
    return {
      id,
      category: this.category,
      severity: opts.severity ?? 'info',
      passed: true,
      message,
      ...opts,
    };
  }

  /**
   * Helper to create a failing check result
   */
  protected fail(
    id: string,
    severity: Severity,
    message: string,
    opts: Partial<CheckResult> = {}
  ): CheckResult {
    return {
      id,
      category: this.category,
      severity,
      passed: false,
      message,
      ...opts,
    };
  }
}
