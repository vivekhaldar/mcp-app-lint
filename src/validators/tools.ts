// ABOUTME: Validates tool descriptors against OpenAI Apps SDK requirements.
// ABOUTME: Checks for required fields, metadata, and proper formatting.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';
import type { Tool } from '../client/mcp.js';

export class ToolValidator extends Validator {
  name = 'tools';
  category = 'tools' as const;

  async run(ctx: ValidationContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    if (!ctx.serverInfo) {
      results.push(this.fail('TOOL_001', 'error',
        'Cannot validate tools: protocol initialization failed'));
      return results;
    }

    // TOOL_001: tools/list returns valid response
    try {
      let tools = await ctx.client.listTools();
      ctx.tools = tools;

      results.push(this.pass('TOOL_001', `tools/list returned ${tools.length} tool(s)`, {
        severity: 'error',
      }));

      // Apply tool filter if specified
      if (ctx.config.toolFilter.length > 0) {
        tools = tools.filter(t => ctx.config.toolFilter.includes(t.name));
      }

      // Validate each tool
      for (const tool of tools) {
        results.push(...this.validateTool(tool));
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(this.fail('TOOL_001', 'error', `tools/list failed: ${message}`));
    }

    return results;
  }

  private validateTool(tool: Tool): CheckResult[] {
    const results: CheckResult[] = [];
    const target = tool.name;

    // TOOL_002: Has name field (always true if we got here)
    results.push(this.pass('TOOL_002', 'Has name field', { severity: 'error', target }));

    // TOOL_003: Has description field
    if (tool.description) {
      results.push(this.pass('TOOL_003', 'Has description field', { severity: 'error', target }));

      // TOOL_004: Description is meaningful (>10 chars)
      if (tool.description.length > 10) {
        results.push(this.pass('TOOL_004', 'Description is meaningful', { severity: 'warn', target }));
      } else {
        results.push(this.fail('TOOL_004', 'warn',
          `Description is too short (${tool.description.length} chars)`, {
          target,
          suggestion: 'Provide a more descriptive description (>10 characters)',
        }));
      }
    } else {
      results.push(this.fail('TOOL_003', 'error', 'Missing description field', { target }));
    }

    // TOOL_005: Has inputSchema
    if (tool.inputSchema) {
      results.push(this.pass('TOOL_005', 'Has inputSchema', { severity: 'error', target }));

      // TOOL_006: inputSchema is valid JSON Schema
      // Basic validation: check it has type property
      if (typeof tool.inputSchema === 'object' && 'type' in tool.inputSchema) {
        results.push(this.pass('TOOL_006', 'inputSchema is valid JSON Schema', {
          severity: 'warn', target
        }));
      } else {
        results.push(this.fail('TOOL_006', 'warn',
          'inputSchema may not be valid JSON Schema (missing "type")', { target }));
      }
    } else {
      results.push(this.fail('TOOL_005', 'error', 'Missing inputSchema', { target }));
    }

    // Access _meta for OpenAI-specific fields
    const meta = this.getMetaField(tool.raw, '_meta') as Record<string, unknown> | undefined;

    // TOOL_007: Has _meta.openai/outputTemplate (CRITICAL)
    const outputTemplate = meta?.['openai/outputTemplate'] as string | undefined;
    if (outputTemplate) {
      results.push(this.pass('TOOL_007', 'Has _meta.openai/outputTemplate', {
        severity: 'error',
        target,
        details: { outputTemplate },
      }));

      // TOOL_008: outputTemplate uses ui://widget/ scheme (CRITICAL)
      if (outputTemplate.startsWith('ui://widget/')) {
        results.push(this.pass('TOOL_008', 'outputTemplate uses ui://widget/ scheme', {
          severity: 'error',
          target,
        }));

        // TOOL_009: outputTemplate ends with .html
        if (outputTemplate.endsWith('.html')) {
          results.push(this.pass('TOOL_009', 'outputTemplate ends with .html', {
            severity: 'warn',
            target,
          }));
        } else {
          results.push(this.fail('TOOL_009', 'warn',
            `outputTemplate does not end with .html: ${outputTemplate}`, {
            target,
            suggestion: 'Widget templates should use .html extension',
          }));
        }
      } else {
        results.push(this.fail('TOOL_008', 'error',
          `outputTemplate must use ui://widget/ scheme, got: ${outputTemplate}`, {
          target,
          suggestion: 'Change outputTemplate to use ui://widget/your-widget.html format',
        }));
      }
    } else {
      results.push(this.fail('TOOL_007', 'error',
        'Missing _meta.openai/outputTemplate (required for ChatGPT Apps)', {
        target,
        suggestion: 'Add _meta: { "openai/outputTemplate": "ui://widget/your-widget.html" }',
        specRef: 'https://developers.openai.com/apps-sdk/build/mcp-server',
      }));
    }

    // TOOL_010-016: Optional fields (INFO level)
    this.checkOptionalMeta(results, meta, target, 'openai/widgetAccessible', 'TOOL_010');
    this.checkOptionalMeta(results, meta, target, 'openai/visibility', 'TOOL_011');

    // TOOL_012: title field (on tool itself, not _meta)
    const title = this.getMetaField(tool.raw, 'title');
    if (title) {
      results.push(this.pass('TOOL_012', 'Has title field', { severity: 'info', target }));
    } else {
      results.push(this.fail('TOOL_012', 'info', 'Missing title field (optional)', { target }));
    }

    // TOOL_013-014: toolInvocation fields
    const invocation = meta?.['openai/toolInvocation'] as Record<string, unknown> | undefined;
    if (invocation?.invoking) {
      const invoking = invocation.invoking as string;
      if (invoking.length <= 64) {
        results.push(this.pass('TOOL_013', 'Has toolInvocation/invoking', {
          severity: 'info', target, details: { invoking }
        }));
      } else {
        results.push(this.fail('TOOL_013', 'info',
          `toolInvocation/invoking exceeds 64 chars (${invoking.length})`, { target }));
      }
    }

    if (invocation?.invoked) {
      const invoked = invocation.invoked as string;
      if (invoked.length <= 64) {
        results.push(this.pass('TOOL_014', 'Has toolInvocation/invoked', {
          severity: 'info', target, details: { invoked }
        }));
      } else {
        results.push(this.fail('TOOL_014', 'info',
          `toolInvocation/invoked exceeds 64 chars (${invoked.length})`, { target }));
      }
    }

    // TOOL_015: Behavioral annotations
    const annotations = tool.annotations;
    if (annotations && Object.keys(annotations).length > 0) {
      results.push(this.pass('TOOL_015', 'Has behavioral annotations', {
        severity: 'info',
        target,
        details: { annotations },
      }));
    }

    // TOOL_016: fileParams
    const fileParams = meta?.['openai/fileParams'];
    if (fileParams) {
      results.push(this.pass('TOOL_016', 'Has fileParams for file handling', {
        severity: 'info',
        target,
        details: { fileParams },
      }));
    }

    return results;
  }

  private getMetaField(obj: unknown, field: string): unknown {
    if (typeof obj === 'object' && obj !== null && field in obj) {
      return (obj as Record<string, unknown>)[field];
    }
    return undefined;
  }

  private checkOptionalMeta(
    results: CheckResult[],
    meta: Record<string, unknown> | undefined,
    target: string,
    field: string,
    checkId: string
  ): void {
    if (meta?.[field] !== undefined) {
      results.push(this.pass(checkId, `Has ${field}`, {
        severity: 'info',
        target,
        details: { [field]: meta[field] },
      }));
    }
  }
}
