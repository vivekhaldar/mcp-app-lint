// ABOUTME: HTML report output for browser viewing.
// ABOUTME: Produces a styled, interactive conformance report.

import type { Reporter } from './index.js';
import type { ConformanceReport } from '../types/report.js';
import type { CheckResult } from '../types/check.js';

export class HtmlReporter implements Reporter {
  format(report: ConformanceReport): string {
    const verdictClass = report.verdict === 'conformant' ? 'success'
      : report.verdict === 'conformant_with_warnings' ? 'warning'
      : 'error';

    const checksHtml = this.renderChecks(report.checks);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChatGPT Apps SDK Conformance Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .verdict { padding: 15px; border-radius: 8px; margin: 20px 0; font-weight: bold; font-size: 1.2em; }
    .verdict.success { background: #d4edda; color: #155724; }
    .verdict.warning { background: #fff3cd; color: #856404; }
    .verdict.error { background: #f8d7da; color: #721c24; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #333; }
    .stat-label { color: #666; font-size: 0.9em; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th { background: #333; color: white; padding: 12px; text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    tr:hover { background: #f9f9f9; }
    .pass { color: #28a745; }
    .fail { color: #dc3545; }
    .warn { color: #ffc107; }
    .info { color: #17a2b8; }
    .suggestion { background: #fff3cd; padding: 8px 12px; margin: 5px 0; border-radius: 4px; font-size: 0.9em; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>ChatGPT Apps SDK Conformance Report</h1>

  <div class="meta">
    <strong>Server:</strong> ${this.escape(report.serverUrl)}<br>
    <strong>Timestamp:</strong> ${this.escape(report.timestamp)}<br>
    <strong>Duration:</strong> ${report.durationMs}ms
    ${report.serverInfo.name ? `<br><strong>Server Name:</strong> ${this.escape(report.serverInfo.name)}` : ''}
    ${report.serverInfo.protocolVersion ? `<br><strong>Protocol:</strong> ${this.escape(report.serverInfo.protocolVersion)}` : ''}
  </div>

  <div class="verdict ${verdictClass}">
    Verdict: ${report.verdict.toUpperCase().replace(/_/g, ' ')}
  </div>

  <h2>Summary</h2>
  <div class="summary">
    <div class="stat">
      <div class="stat-value">${report.summary.totalChecks}</div>
      <div class="stat-label">Total Checks</div>
    </div>
    <div class="stat">
      <div class="stat-value pass">${report.summary.passed}</div>
      <div class="stat-label">Passed</div>
    </div>
    <div class="stat">
      <div class="stat-value warn">${report.summary.warnings}</div>
      <div class="stat-label">Warnings</div>
    </div>
    <div class="stat">
      <div class="stat-value fail">${report.summary.errors}</div>
      <div class="stat-label">Errors</div>
    </div>
    <div class="stat">
      <div class="stat-value">${report.summary.toolCount}</div>
      <div class="stat-label">Tools</div>
    </div>
    <div class="stat">
      <div class="stat-value">${report.summary.resourceCount}</div>
      <div class="stat-label">Resources</div>
    </div>
  </div>

  ${checksHtml}

</body>
</html>`;
  }

  private renderChecks(checks: CheckResult[]): string {
    const categories = this.groupByCategory(checks);
    let html = '';

    for (const [category, categoryChecks] of Object.entries(categories)) {
      html += `<h2>${this.escape(category.charAt(0).toUpperCase() + category.slice(1))} Checks</h2>\n`;
      html += '<table>\n';
      html += '<tr><th>Status</th><th>ID</th><th>Target</th><th>Message</th></tr>\n';

      for (const check of categoryChecks) {
        const statusClass = check.passed ? 'pass' : (check.severity === 'error' ? 'fail' : 'warn');
        const statusSymbol = check.passed ? '✓' : (check.severity === 'error' ? '✗' : '⚠');
        html += `<tr>
          <td class="${statusClass}">${statusSymbol}</td>
          <td>${this.escape(check.id)}</td>
          <td>${this.escape(check.target || '-')}</td>
          <td>${this.escape(check.message)}${!check.passed && check.suggestion ? `<div class="suggestion">💡 ${this.escape(check.suggestion)}</div>` : ''}</td>
        </tr>\n`;
      }

      html += '</table>\n';
    }

    return html;
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

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
