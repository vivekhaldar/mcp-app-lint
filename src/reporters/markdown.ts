// ABOUTME: Markdown output for documentation and GitHub integration.
// ABOUTME: Produces a readable report suitable for PRs and wikis.

import type { Reporter } from './index.js';
import type { ConformanceReport } from '../types/report.js';
import type { CheckResult } from '../types/check.js';

export class MarkdownReporter implements Reporter {
  format(report: ConformanceReport): string {
    const lines: string[] = [];

    // Header
    lines.push('# ChatGPT Apps SDK Conformance Report');
    lines.push('');
    lines.push(`**Server:** ${report.serverUrl}`);
    lines.push(`**Timestamp:** ${report.timestamp}`);
    lines.push(`**Duration:** ${report.durationMs}ms`);
    lines.push('');

    if (report.serverInfo.name) {
      lines.push(`**Server Name:** ${report.serverInfo.name}`);
    }
    if (report.serverInfo.protocolVersion) {
      lines.push(`**Protocol Version:** ${report.serverInfo.protocolVersion}`);
    }
    lines.push('');

    // Verdict badge
    const verdictEmoji = report.verdict === 'conformant' ? '✅'
      : report.verdict === 'conformant_with_warnings' ? '⚠️'
      : '❌';
    lines.push(`## Verdict: ${verdictEmoji} ${report.verdict.toUpperCase().replace(/_/g, ' ')}`);
    lines.push('');

    // Summary table
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Checks | ${report.summary.totalChecks} |`);
    lines.push(`| Passed | ${report.summary.passed} |`);
    lines.push(`| Warnings | ${report.summary.warnings} |`);
    lines.push(`| Errors | ${report.summary.errors} |`);
    lines.push(`| Tools | ${report.summary.toolCount} |`);
    lines.push(`| Resources | ${report.summary.resourceCount} |`);
    lines.push('');

    // Group checks by category
    const categories = this.groupByCategory(report.checks);

    for (const [category, checks] of Object.entries(categories)) {
      lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)} Checks`);
      lines.push('');

      // Table header
      lines.push('| Status | ID | Target | Message |');
      lines.push('|--------|-----|--------|---------|');

      for (const check of checks) {
        const status = check.passed ? '✅' : (check.severity === 'error' ? '❌' : '⚠️');
        const target = check.target || '-';
        lines.push(`| ${status} | ${check.id} | ${target} | ${check.message} |`);
      }
      lines.push('');

      // List failed checks with suggestions
      const failed = checks.filter(c => !c.passed && c.suggestion);
      if (failed.length > 0) {
        lines.push('### Suggestions');
        lines.push('');
        for (const check of failed) {
          lines.push(`- **${check.id}** (${check.target || 'general'}): ${check.suggestion}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private groupByCategory(checks: CheckResult[]): Record<string, CheckResult[]> {
    const groups: Record<string, CheckResult[]> = {};
    for (const check of checks) {
      if (!groups[check.category]) {
        groups[check.category] = [];
      }
      groups[check.category].push(check);
    }
    return groups;
  }
}
