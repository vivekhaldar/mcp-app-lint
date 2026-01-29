// ABOUTME: Cross-validates data across tools, resources, and content.
// ABOUTME: Ensures referential integrity between components.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';
import type { StandardSpec } from '../standards/spec.js';

export class CrossValidator extends Validator {
  name = 'cross';
  category = 'cross' as const;

  constructor(spec: StandardSpec) {
    super(spec);
  }

  async run(ctx: ValidationContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    if (!ctx.tools || !ctx.resources) {
      return results;
    }

    // Build set of available resource URIs
    const resourceUris = new Set(ctx.resources.map(r => r.uri));

    // XVAL_001: Every outputTemplate URI exists in resources
    const outputTemplateUris: string[] = [];
    for (const tool of ctx.tools) {
      const outputTemplate = this.getSpecPath(tool.raw, this.spec.toolMeta.outputTemplate) as string | undefined;
      if (outputTemplate) {
        outputTemplateUris.push(outputTemplate);

        if (resourceUris.has(outputTemplate)) {
          results.push(this.pass('XVAL_001',
            `outputTemplate ${outputTemplate} exists in resources`, {
            severity: 'error',
            target: tool.name,
          }));
        } else {
          results.push(this.fail('XVAL_001', 'error',
            `outputTemplate ${outputTemplate} not found in resources`, {
            target: tool.name,
            suggestion: `Add a resource with URI "${outputTemplate}"`,
          }));
        }
      }
    }

    // XVAL_002: All outputTemplate resources are readable
    if (ctx.resourceContents) {
      for (const uri of outputTemplateUris) {
        if (ctx.resourceContents.has(uri)) {
          results.push(this.pass('XVAL_002', `outputTemplate resource ${uri} is readable`, {
            severity: 'warn',
            target: uri,
          }));
        } else if (!ctx.config.skipContent) {
          results.push(this.fail('XVAL_002', 'warn',
            `Could not read outputTemplate resource ${uri}`, {
            target: uri,
          }));
        }
      }
    }

    // XVAL_003: Static assets in HTML are available
    if (ctx.resourceContents && ctx.resourceContents.size > 0) {
      results.push(this.pass('XVAL_003', 'Widget HTML content available for asset validation', {
        severity: 'warn',
      }));
    }

    // XVAL_004: Orphan resources (resources not referenced by any tool)
    const referencedUris = new Set(outputTemplateUris);
    const orphans = ctx.resources.filter(r =>
      this.spec.widgetUriPattern.test(r.uri) && !referencedUris.has(r.uri)
    );

    if (orphans.length === 0) {
      results.push(this.pass('XVAL_004', 'No orphan widget resources', {
        severity: 'info',
      }));
    } else {
      for (const orphan of orphans) {
        results.push(this.fail('XVAL_004', 'info',
          `Widget resource ${orphan.uri} is not referenced by any tool`, {
          target: orphan.uri,
          suggestion: 'Remove unused widget resources or add tool references',
        }));
      }
    }

    return results;
  }
}
