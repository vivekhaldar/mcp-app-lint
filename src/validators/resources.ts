// ABOUTME: Validates resource descriptors against OpenAI Apps SDK requirements.
// ABOUTME: Ensures widget resources use correct URI scheme and MIME types.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';
import type { Resource } from '../client/mcp.js';

export class ResourceValidator extends Validator {
  name = 'resources';
  category = 'resources' as const;

  async run(ctx: ValidationContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    if (!ctx.serverInfo) {
      results.push(this.fail('RES_001', 'error',
        'Cannot validate resources: protocol initialization failed'));
      return results;
    }

    // RES_001: resources/list returns valid response
    try {
      const resources = await ctx.client.listResources();
      ctx.resources = resources;

      results.push(this.pass('RES_001', `resources/list returned ${resources.length} resource(s)`, {
        severity: 'error',
      }));

      // Validate each resource
      for (const resource of resources) {
        results.push(...this.validateResource(resource));
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push(this.fail('RES_001', 'error', `resources/list failed: ${message}`));
    }

    return results;
  }

  private validateResource(resource: Resource): CheckResult[] {
    const results: CheckResult[] = [];
    const target = resource.uri;
    const isWidget = resource.uri.startsWith('ui://widget/');

    if (isWidget) {
      // RES_002: Widget resource uses ui://widget/ URI scheme
      results.push(this.pass('RES_002', 'Uses ui://widget/ URI scheme', {
        severity: 'error',
        target,
      }));

      // RES_003: Widget has text/html+skybridge MIME type
      if (resource.mimeType === 'text/html+skybridge') {
        results.push(this.pass('RES_003', 'Has text/html+skybridge MIME type', {
          severity: 'error',
          target,
        }));
      } else {
        results.push(this.fail('RES_003', 'error',
          `Widget MIME type should be text/html+skybridge, got: ${resource.mimeType}`, {
          target,
          suggestion: 'Set mimeType to "text/html+skybridge" for widget resources',
        }));
      }

      // Widget-specific optional fields
      const meta = this.getMeta(resource.raw);

      // RES_006: widgetDescription
      if (meta?.['openai/widgetDescription']) {
        results.push(this.pass('RES_006', 'Has widgetDescription', {
          severity: 'info',
          target,
        }));
      }

      // RES_007: widgetPrefersBorder
      if (meta?.['openai/widgetPrefersBorder'] !== undefined) {
        results.push(this.pass('RES_007', 'Has widgetPrefersBorder', {
          severity: 'info',
          target,
        }));
      }

      // RES_008 & RES_009: widgetCSP
      const csp = meta?.['openai/widgetCSP'] as Record<string, unknown> | undefined;
      if (csp) {
        results.push(this.pass('RES_008', 'Has widgetCSP configuration', {
          severity: 'info',
          target,
          details: { csp },
        }));

        // RES_009: Warn if frame_domains is set
        if (csp.frame_domains && Array.isArray(csp.frame_domains) && csp.frame_domains.length > 0) {
          results.push(this.fail('RES_009', 'warn',
            'Using frame_domains triggers stricter review process', {
            target,
            details: { frame_domains: csp.frame_domains },
            suggestion: 'Only use frame_domains if iframes are essential',
          }));
        }
      }
    }

    // RES_004: Has human-readable name (required per MCP spec)
    if (resource.name && resource.name.length > 0) {
      results.push(this.pass('RES_004', 'Has human-readable name', {
        severity: 'error',
        target,
      }));
    } else {
      results.push(this.fail('RES_004', 'error', 'Missing required name field', {
        target,
        suggestion: 'Add a name field (required by MCP specification)',
      }));
    }

    // RES_005: Has description
    if (resource.description) {
      results.push(this.pass('RES_005', 'Has description', {
        severity: 'info',
        target,
      }));
    }

    return results;
  }

  private getMeta(obj: unknown): Record<string, unknown> | undefined {
    if (typeof obj === 'object' && obj !== null && '_meta' in obj) {
      return (obj as Record<string, unknown>)._meta as Record<string, unknown>;
    }
    return undefined;
  }
}
