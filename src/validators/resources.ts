// ABOUTME: Validates resource descriptors against standard-specific requirements.
// ABOUTME: Ensures widget resources use correct URI scheme and MIME types.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';
import type { Resource } from '../client/mcp.js';
import type { StandardSpec } from '../standards/spec.js';

export class ResourceValidator extends Validator {
  name = 'resources';
  category = 'resources' as const;

  constructor(spec: StandardSpec) {
    super(spec);
  }

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
    const isWidget = this.spec.widgetUriPattern.test(resource.uri);

    if (isWidget) {
      // RES_002: Widget resource uses correct URI scheme
      results.push(this.pass('RES_002', `Uses ${this.spec.widgetUriScheme} URI scheme`, {
        severity: 'error',
        target,
      }));

      // RES_003: Widget has correct MIME type
      if (resource.mimeType === this.spec.widgetMimeType) {
        results.push(this.pass('RES_003', `Has ${this.spec.widgetMimeType} MIME type`, {
          severity: 'error',
          target,
        }));
      } else {
        results.push(this.fail('RES_003', 'error',
          `Widget MIME type should be ${this.spec.widgetMimeType}, got: ${resource.mimeType}`, {
          target,
          suggestion: `Set mimeType to "${this.spec.widgetMimeType}" for widget resources`,
        }));
      }

      // Widget-specific optional fields (only if paths exist in standard)
      // RES_006: widgetDescription
      if (this.spec.resourceMeta.widgetDescription) {
        if (this.hasSpecPath(resource.raw, this.spec.resourceMeta.widgetDescription)) {
          results.push(this.pass('RES_006', 'Has widgetDescription', {
            severity: 'info',
            target,
          }));
        }
      }

      // RES_007: widgetPrefersBorder
      if (this.spec.resourceMeta.widgetPrefersBorder) {
        if (this.hasSpecPath(resource.raw, this.spec.resourceMeta.widgetPrefersBorder)) {
          results.push(this.pass('RES_007', 'Has widgetPrefersBorder', {
            severity: 'info',
            target,
          }));
        }
      }

      // RES_008 & RES_009: widgetCSP
      if (this.spec.resourceMeta.csp) {
        const csp = this.getSpecPath(resource.raw, this.spec.resourceMeta.csp) as Record<string, unknown> | undefined;
        if (csp) {
          results.push(this.pass('RES_008', 'Has CSP configuration', {
            severity: 'info',
            target,
            details: { csp },
          }));

          // RES_009: Warn if frame_domains is set
          const frameDomains = csp[this.spec.cspFields.frameDomains];
          if (frameDomains && Array.isArray(frameDomains) && frameDomains.length > 0) {
            results.push(this.fail('RES_009', 'warn',
              'Using frame domains triggers stricter review process', {
              target,
              details: { [this.spec.cspFields.frameDomains]: frameDomains },
              suggestion: 'Only use frame domains if iframes are essential',
            }));
          }
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
}
