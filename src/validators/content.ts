// ABOUTME: Validates resource content, especially widget HTML structure.
// ABOUTME: Parses HTML and checks for required elements and blocked APIs.

import { Validator } from './base.js';
import type { ValidationContext } from './index.js';
import type { CheckResult } from '../types/check.js';
import type { StandardSpec } from '../standards/spec.js';
import * as htmlparser2 from 'htmlparser2';

const BLOCKED_APIS = [
  'window.alert',
  'window.prompt',
  'window.confirm',
  'navigator.clipboard',
];

export class ContentValidator extends Validator {
  name = 'content';
  category = 'content' as const;

  constructor(spec: StandardSpec) {
    super(spec);
  }

  async run(ctx: ValidationContext): Promise<CheckResult[]> {
    const results: CheckResult[] = [];

    if (ctx.config.skipContent) {
      results.push(this.pass('READ_SKIP', 'Content validation skipped by user', {
        severity: 'info',
      }));
      return results;
    }

    if (!ctx.resources || ctx.resources.length === 0) {
      return results; // No resources to validate
    }

    ctx.resourceContents = new Map();

    // Only validate widget resources using the spec's pattern
    const widgets = ctx.resources.filter(r => this.spec.widgetUriPattern.test(r.uri));

    for (const resource of widgets) {
      const target = resource.uri;

      // READ_001: Resource is readable
      try {
        const content = await ctx.client.readResource(resource.uri);
        ctx.resourceContents.set(resource.uri, content);

        results.push(this.pass('READ_001', 'Resource is readable', {
          severity: 'error',
          target,
        }));

        // READ_002: Response has contents (implicit if we got here)
        results.push(this.pass('READ_002', 'Response has contents array', {
          severity: 'error',
          target,
        }));

        // READ_003: Content has text or blob
        if (content.text || content.blob) {
          results.push(this.pass('READ_003', 'Content has text or blob field', {
            severity: 'error',
            target,
          }));
        } else {
          results.push(this.fail('READ_003', 'error',
            'Content missing both text and blob fields', { target }));
          continue;
        }

        // Get HTML content (use Buffer.from for Node.js compatibility)
        const html = content.text || (content.blob ? Buffer.from(content.blob, 'base64').toString('utf-8') : '');

        // READ_004: Valid HTML5
        const parseResult = this.parseHTML(html);
        if (parseResult.isValid) {
          results.push(this.pass('READ_004', 'Widget HTML is valid HTML5', {
            severity: 'error',
            target,
          }));
        } else {
          results.push(this.fail('READ_004', 'error',
            `Invalid HTML: ${parseResult.error}`, { target }));
        }

        // READ_005: Has meta charset
        if (parseResult.hasCharset) {
          results.push(this.pass('READ_005', 'Has <meta charset>', {
            severity: 'info',
            target,
          }));
        } else {
          results.push(this.fail('READ_005', 'info',
            'Missing <meta charset> (recommended)', { target }));
        }

        // READ_006: Has title
        if (parseResult.hasTitle) {
          results.push(this.pass('READ_006', 'Has <title>', {
            severity: 'info',
            target,
          }));
        } else {
          results.push(this.fail('READ_006', 'info',
            'Missing <title> (recommended)', { target }));
        }

        // READ_007: Check for blocked APIs
        const blockedFound = this.findBlockedAPIs(html);
        if (blockedFound.length === 0) {
          results.push(this.pass('READ_007', 'No blocked APIs detected', {
            severity: 'warn',
            target,
          }));
        } else {
          results.push(this.fail('READ_007', 'warn',
            `Found blocked APIs: ${blockedFound.join(', ')}`, {
            target,
            suggestion: 'Remove usage of blocked APIs (alert, prompt, confirm, clipboard)',
          }));
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push(this.fail('READ_001', 'error',
          `Failed to read resource: ${message}`, { target }));
      }
    }

    return results;
  }

  private parseHTML(html: string): {
    isValid: boolean;
    error?: string;
    hasCharset: boolean;
    hasTitle: boolean;
  } {
    let isValid = true;
    let error: string | undefined;
    let hasCharset = false;
    let hasTitle = false;
    let inTitle = false;

    const parser = new htmlparser2.Parser({
      onopentag(name, attrs) {
        if (name === 'meta' && (attrs.charset || attrs['http-equiv']?.toLowerCase() === 'content-type')) {
          hasCharset = true;
        }
        if (name === 'title') {
          inTitle = true;
        }
      },
      onclosetag(name) {
        if (name === 'title') {
          inTitle = false;
        }
      },
      ontext(text) {
        if (inTitle && text.trim().length > 0) {
          hasTitle = true;
        }
      },
      onerror(err) {
        isValid = false;
        error = err.message;
      },
    }, { decodeEntities: true });

    try {
      parser.write(html);
      parser.end();
    } catch (e) {
      isValid = false;
      error = e instanceof Error ? e.message : String(e);
    }

    return { isValid, error, hasCharset, hasTitle };
  }

  private findBlockedAPIs(html: string): string[] {
    const found: string[] = [];
    for (const api of BLOCKED_APIS) {
      // Simple string search - could be improved with AST parsing
      if (html.includes(api)) {
        found.push(api);
      }
    }
    return found;
  }
}
