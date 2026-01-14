// ABOUTME: Validates tool execution responses meet OpenAI Apps SDK format.
// ABOUTME: Calls each tool and checks response structure.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';

export class ExecutionValidator extends Validator {
  name = 'execution';
  category = 'execution' as const;

  async run(ctx: ValidationContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    // SAFETY: Tool execution is opt-in by default to prevent destructive side effects
    if (ctx.config.skipExecution) {
      results.push(this.pass('EXEC_SKIP',
        'Tool execution skipped (use --execute or --execute-safe to enable)', {
        severity: 'info',
      }));
      return results;
    }

    if (!ctx.tools || ctx.tools.length === 0) {
      results.push(this.fail('EXEC_001', 'error',
        'Cannot validate execution: no tools available'));
      return results;
    }

    ctx.toolResponses = new Map();

    for (const tool of ctx.tools) {
      // Apply tool filter
      if (ctx.config.toolFilter.length > 0 && !ctx.config.toolFilter.includes(tool.name)) {
        continue;
      }

      const target = tool.name;

      // SAFETY: If executeSafeOnly is set, skip tools without readOnlyHint=true
      if (ctx.config.executeSafeOnly) {
        const readOnlyHint = tool.annotations?.readOnlyHint;
        if (readOnlyHint !== true) {
          results.push(this.pass('EXEC_SKIP_UNSAFE',
            `Skipped tool '${target}' (not marked readOnlyHint=true)`, {
            severity: 'info',
            target,
          }));
          continue;
        }
      }

      // EXEC_001: Tool call succeeds
      try {
        // Call with empty args for tools with no required parameters.
        // For tools with required params, this may fail - which is itself useful validation.
        // Future enhancement: generate minimal args from JSON Schema or use fixtures.
        const response = await ctx.client.callTool(tool.name, {});
        ctx.toolResponses.set(tool.name, response);

        if (response.isError) {
          results.push(this.fail('EXEC_001', 'error',
            `Tool call returned error`, { target }));
          continue;
        }

        results.push(this.pass('EXEC_001', 'Tool call succeeded', {
          severity: 'error',
          target,
        }));

        // EXEC_002: Has structuredContent
        if (response.structuredContent !== undefined) {
          results.push(this.pass('EXEC_002', 'Has structuredContent field', {
            severity: 'info',
            target,
            details: { keys: Object.keys(response.structuredContent) },
          }));

          // EXEC_003: structuredContent is non-empty
          if (Object.keys(response.structuredContent).length > 0) {
            results.push(this.pass('EXEC_003', 'structuredContent is non-empty', {
              severity: 'warn',
              target,
            }));
          } else {
            results.push(this.fail('EXEC_003', 'warn',
              'structuredContent is empty object', { target }));
          }
        }

        // EXEC_004: Has content array
        if (response.content && Array.isArray(response.content)) {
          results.push(this.pass('EXEC_004', 'Has content array', {
            severity: 'info',
            target,
          }));

          // EXEC_005: content includes text item
          const hasText = response.content.some(c => c.type === 'text' && c.text);
          if (hasText) {
            results.push(this.pass('EXEC_005', 'content includes text item', {
              severity: 'info',
              target,
            }));
          }
        }

        // EXEC_006: Has _meta field
        if (response._meta !== undefined) {
          results.push(this.pass('EXEC_006', 'Has _meta field for widget-only data', {
            severity: 'info',
            target,
          }));
        }

        // EXEC_007: Has at least one of structuredContent, content, or _meta
        const hasStructured = response.structuredContent !== undefined;
        const hasContent = response.content && response.content.length > 0;
        const hasMeta = response._meta !== undefined;

        if (hasStructured || hasContent || hasMeta) {
          results.push(this.pass('EXEC_007', 'Has response data', {
            severity: 'warn',
            target,
          }));
        } else {
          results.push(this.fail('EXEC_007', 'warn',
            'Response has no structuredContent, content, or _meta', {
            target,
            suggestion: 'Return at least one of structuredContent, content, or _meta',
          }));
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push(this.fail('EXEC_001', 'error',
          `Tool call failed: ${message}`, { target }));
      }
    }

    return results;
  }
}
