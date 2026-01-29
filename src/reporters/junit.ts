// ABOUTME: JUnit XML output for CI/CD integration.
// ABOUTME: Compatible with Jenkins, GitHub Actions, and other CI systems.

import type { Reporter } from './index.js';
import type { ConformanceReport } from '../types/report.js';

export class JUnitReporter implements Reporter {
  format(report: ConformanceReport): string {
    const failures = report.checks.filter(c => !c.passed && c.severity === 'error').length;
    const warnings = report.checks.filter(c => !c.passed && c.severity === 'warn').length;
    const tests = report.summary.totalChecks;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuite name="${this.escape(report.standardName)} Conformance" tests="${tests}" failures="${failures + warnings}" time="${report.durationMs / 1000}">\n`;

    for (const check of report.checks) {
      const className = `conformance.${check.category}`;
      const testName = check.target ? `${check.id}: ${check.target}` : check.id;

      xml += `  <testcase classname="${this.escape(className)}" name="${this.escape(testName)}">\n`;

      if (!check.passed) {
        const failureType = check.severity === 'error' ? 'error' : 'warning';
        xml += `    <failure type="${failureType}" message="${this.escape(check.message)}">\n`;
        if (check.suggestion) {
          xml += `      Suggestion: ${this.escape(check.suggestion)}\n`;
        }
        if (check.details) {
          xml += `      Details: ${this.escape(JSON.stringify(check.details))}\n`;
        }
        xml += `    </failure>\n`;
      }

      xml += `  </testcase>\n`;
    }

    xml += `</testsuite>\n`;
    return xml;
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
