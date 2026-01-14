// ABOUTME: Reporter factory and interface for output formatting.
// ABOUTME: Supports multiple output formats for different use cases.

import type { ConformanceReport } from '../types/report.js';

export interface Reporter {
  format(report: ConformanceReport): string;
}

export type ReportFormat = 'text' | 'json' | 'markdown' | 'html' | 'junit';

export class ReporterFactory {
  static async create(format: ReportFormat): Promise<Reporter> {
    switch (format) {
      case 'text':
        const { TextReporter } = await import('./text.js');
        return new TextReporter();
      case 'json':
        const { JsonReporter } = await import('./json.js');
        return new JsonReporter();
      case 'markdown':
        const { MarkdownReporter } = await import('./markdown.js');
        return new MarkdownReporter();
      case 'html':
        const { HtmlReporter } = await import('./html.js');
        return new HtmlReporter();
      case 'junit':
        const { JUnitReporter } = await import('./junit.js');
        return new JUnitReporter();
      default:
        throw new Error(`Unknown report format: ${format}`);
    }
  }
}
