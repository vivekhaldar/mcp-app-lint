// ABOUTME: Base class providing common utilities for all validators.
// ABOUTME: Includes helper methods for creating check results.

import type { ValidationContext } from './index.js';
import type { CheckResult, Severity, Category } from '../types/check.js';

export abstract class Validator {
  abstract name: string;
  abstract category: Category;

  abstract run(ctx: ValidationContext): Promise<CheckResult[]>;

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
