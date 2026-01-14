// ABOUTME: Developer-friendly HTML conformance report with excellent typography.
// ABOUTME: Provides actionable feedback with human-readable descriptions, no cryptic IDs.

import type { Reporter } from './index.js';
import type { ConformanceReport } from '../types/report.js';
import type { CheckResult, Category } from '../types/check.js';

// Human-readable descriptions for check IDs
const CHECK_DESCRIPTIONS: Record<string, string> = {
  // Protocol checks
  CONN_001: 'Server responds to HTTP requests',
  CONN_002: 'Server accepts JSON content type',
  CONN_003: 'Server returns valid JSON-RPC responses',
  PROTO_001: 'Server reports protocol version',
  PROTO_002: 'Protocol version meets minimum requirement',
  PROTO_003: 'Server advertises capabilities',

  // Tool checks
  TOOL_001: 'Tools list is accessible',
  TOOL_002: 'Tool has machine-readable name',
  TOOL_003: 'Tool has description',
  TOOL_004: 'Tool description is meaningful',
  TOOL_005: 'Tool has input schema',
  TOOL_006: 'Input schema is valid JSON Schema',
  TOOL_007: 'Tool has widget output template',
  TOOL_008: 'Output template uses correct URI scheme',
  TOOL_009: 'Output template uses .html extension',
  TOOL_010: 'Widget accessibility configured',
  TOOL_011: 'Tool visibility configured',
  TOOL_012: 'Tool has display title',
  TOOL_013: 'Tool has "invoking" status message',
  TOOL_014: 'Tool has "invoked" status message',
  TOOL_015: 'Tool has behavioral annotations',
  TOOL_016: 'Tool has file parameter configuration',

  // Resource checks
  RES_001: 'Resources list is accessible',
  RES_002: 'Widget uses correct URI scheme',
  RES_003: 'Widget has correct MIME type',
  RES_004: 'Resource has human-readable name',
  RES_005: 'Resource has description',
  RES_006: 'Widget has accessibility description',
  RES_007: 'Widget border preference configured',
  RES_008: 'Widget has CSP configuration',
  RES_009: 'Frame domains require stricter review',

  // Execution checks
  EXEC_SKIP: 'Tool execution was skipped',
  EXEC_SKIP_UNSAFE: 'Tool skipped (not marked read-only)',
  EXEC_001: 'Tool executes successfully',
  EXEC_002: 'Response has structured content',
  EXEC_003: 'Structured content is non-empty',
  EXEC_004: 'Response has content array',
  EXEC_005: 'Response includes text content',
  EXEC_006: 'Response has widget metadata',
  EXEC_007: 'Response has usable data',

  // Content checks
  READ_SKIP: 'Content validation was skipped',
  READ_001: 'Widget HTML is readable',
  READ_002: 'Response has content',
  READ_003: 'Content has text or binary data',
  READ_004: 'Widget HTML is valid',
  READ_005: 'Widget has character encoding',
  READ_006: 'Widget has title',
  READ_007: 'Widget avoids blocked browser APIs',

  // Cross-validation checks
  XVAL_001: 'Output template resource exists',
  XVAL_002: 'Output template resource is readable',
  XVAL_003: 'Widget assets are available',
  XVAL_004: 'No orphan widget resources',
};

const CATEGORY_TITLES: Record<Category, string> = {
  protocol: 'Connection & Protocol',
  tools: 'Tool Configuration',
  resources: 'Widget Resources',
  execution: 'Tool Execution',
  content: 'Widget Content',
  cross: 'Cross-Validation',
};

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  protocol: 'Validates the MCP server connection and protocol compliance',
  tools: 'Checks tool metadata required for ChatGPT Apps integration',
  resources: 'Validates widget resources and their configuration',
  execution: 'Tests tool execution and response format',
  content: 'Analyzes widget HTML structure and compatibility',
  cross: 'Ensures consistency between tools and resources',
};

export class HtmlReporter implements Reporter {
  format(report: ConformanceReport): string {
    const verdictClass = report.verdict === 'conformant' ? 'success'
      : report.verdict === 'conformant_with_warnings' ? 'warning'
      : 'error';

    const verdictText = report.verdict === 'conformant' ? 'Fully Conformant'
      : report.verdict === 'conformant_with_warnings' ? 'Conformant with Warnings'
      : 'Not Conformant';

    const verdictEmoji = report.verdict === 'conformant' ? '✅'
      : report.verdict === 'conformant_with_warnings' ? '⚠️'
      : '❌';

    const checksHtml = this.renderChecks(report);
    const toolsHtml = this.renderTools(report);
    const resourcesHtml = this.renderResources(report);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conformance Report: ${this.escape(report.serverInfo.name || 'MCP Server')}</title>
  <style>
    :root {
      --font-mono: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
      --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      --color-bg: #fafafa;
      --color-surface: #ffffff;
      --color-border: #e5e5e5;
      --color-text: #1a1a1a;
      --color-text-secondary: #666666;
      --color-text-tertiary: #999999;
      --color-success: #059669;
      --color-success-bg: #ecfdf5;
      --color-warning: #d97706;
      --color-warning-bg: #fffbeb;
      --color-error: #dc2626;
      --color-error-bg: #fef2f2;
      --color-info: #0284c7;
      --color-info-bg: #f0f9ff;
      --color-accent: #6366f1;
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1);
      --radius: 8px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-sans);
      font-size: 15px;
      line-height: 1.6;
      color: var(--color-text);
      background: var(--color-bg);
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 48px 24px;
    }

    /* Header */
    header {
      margin-bottom: 48px;
    }

    .server-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--color-accent);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    h1 {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 16px;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      color: var(--color-text-secondary);
      font-size: 14px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .meta-label {
      color: var(--color-text-tertiary);
    }

    /* Verdict Banner */
    .verdict {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 24px;
      border-radius: var(--radius);
      margin-bottom: 48px;
    }

    .verdict.success { background: var(--color-success-bg); border: 1px solid var(--color-success); }
    .verdict.warning { background: var(--color-warning-bg); border: 1px solid var(--color-warning); }
    .verdict.error { background: var(--color-error-bg); border: 1px solid var(--color-error); }

    .verdict-emoji { font-size: 32px; }

    .verdict-text h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .verdict.success .verdict-text h2 { color: var(--color-success); }
    .verdict.warning .verdict-text h2 { color: var(--color-warning); }
    .verdict.error .verdict-text h2 { color: var(--color-error); }

    .verdict-text p {
      color: var(--color-text-secondary);
      font-size: 14px;
    }

    /* Stats Grid */
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
      margin-bottom: 48px;
    }

    .stat {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      padding: 20px;
      text-align: center;
    }

    .stat-value {
      font-size: 36px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 1;
      margin-bottom: 4px;
    }

    .stat-value.success { color: var(--color-success); }
    .stat-value.warning { color: var(--color-warning); }
    .stat-value.error { color: var(--color-error); }

    .stat-label {
      font-size: 13px;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* Sections */
    section {
      margin-bottom: 48px;
    }

    .section-header {
      margin-bottom: 16px;
    }

    .section-header h2 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .section-header p {
      font-size: 14px;
      color: var(--color-text-secondary);
    }

    /* Check Cards */
    .check-group {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      overflow: hidden;
      margin-bottom: 16px;
    }

    .check-group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: #f9fafb;
      border-bottom: 1px solid var(--color-border);
    }

    .check-group-title {
      font-weight: 600;
      font-size: 15px;
    }

    .check-group-badge {
      font-size: 12px;
      font-weight: 500;
      padding: 4px 10px;
      border-radius: 100px;
    }

    .check-group-badge.all-pass { background: var(--color-success-bg); color: var(--color-success); }
    .check-group-badge.has-issues { background: var(--color-error-bg); color: var(--color-error); }

    .check-list {
      list-style: none;
    }

    .check-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--color-border);
    }

    .check-item:last-child { border-bottom: none; }

    .check-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      margin-top: 2px;
    }

    .check-icon.pass { color: var(--color-success); }
    .check-icon.fail { color: var(--color-error); }
    .check-icon.warn { color: var(--color-warning); }
    .check-icon.info { color: var(--color-info); }

    .check-content { flex: 1; min-width: 0; }

    .check-title {
      font-weight: 500;
      margin-bottom: 2px;
    }

    .check-detail {
      font-size: 13px;
      color: var(--color-text-secondary);
    }

    .check-target {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--color-accent);
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
    }

    .suggestion {
      margin-top: 8px;
      padding: 10px 12px;
      background: var(--color-warning-bg);
      border-left: 3px solid var(--color-warning);
      border-radius: 0 4px 4px 0;
      font-size: 13px;
    }

    .suggestion-label {
      font-weight: 600;
      color: var(--color-warning);
      margin-bottom: 2px;
    }

    /* Inventory Tables */
    .inventory {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .inventory table {
      width: 100%;
      border-collapse: collapse;
    }

    .inventory th {
      text-align: left;
      padding: 12px 16px;
      background: #f9fafb;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: var(--color-text-secondary);
      border-bottom: 1px solid var(--color-border);
    }

    .inventory td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);
      font-size: 14px;
    }

    .inventory tr:last-child td { border-bottom: none; }

    .inventory code {
      font-family: var(--font-mono);
      font-size: 13px;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 100px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .badge.widget { background: #ede9fe; color: #7c3aed; }
    .badge.yes { background: var(--color-success-bg); color: var(--color-success); }
    .badge.no { background: #f3f4f6; color: var(--color-text-tertiary); }

    /* Footer */
    footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid var(--color-border);
      color: var(--color-text-tertiary);
      font-size: 13px;
      text-align: center;
    }

    footer a {
      color: var(--color-accent);
      text-decoration: none;
    }

    footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="server-name">${this.escape(report.serverInfo.name || 'MCP Server')}</div>
      <h1>Conformance Report</h1>
      <div class="meta">
        <div class="meta-item">
          <span class="meta-label">Endpoint:</span>
          <code>${this.escape(report.serverUrl)}</code>
        </div>
        <div class="meta-item">
          <span class="meta-label">Protocol:</span>
          <span>${this.escape(report.serverInfo.protocolVersion || 'Unknown')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Duration:</span>
          <span>${report.durationMs}ms</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Generated:</span>
          <span>${new Date(report.timestamp).toLocaleString()}</span>
        </div>
      </div>
    </header>

    <div class="verdict ${verdictClass}">
      <div class="verdict-emoji">${verdictEmoji}</div>
      <div class="verdict-text">
        <h2>${verdictText}</h2>
        <p>${this.getVerdictDescription(report)}</p>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${report.summary.totalChecks}</div>
        <div class="stat-label">Checks Run</div>
      </div>
      <div class="stat">
        <div class="stat-value success">${report.summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat">
        <div class="stat-value warning">${report.summary.warnings}</div>
        <div class="stat-label">Warnings</div>
      </div>
      <div class="stat">
        <div class="stat-value error">${report.summary.errors}</div>
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

    ${toolsHtml}

    ${resourcesHtml}

    <footer>
      Generated by <a href="https://github.com/vivekhaldar/chatgpt-app-conformance">chatgpt-app-check</a> ·
      <a href="https://developers.openai.com/apps-sdk">OpenAI Apps SDK Documentation</a>
    </footer>
  </div>
</body>
</html>`;
  }

  private getVerdictDescription(report: ConformanceReport): string {
    if (report.verdict === 'conformant') {
      return 'Your MCP server meets all ChatGPT Apps SDK requirements. You\'re ready to submit for review.';
    } else if (report.verdict === 'conformant_with_warnings') {
      return `Your server is functional but has ${report.summary.warnings} warning(s) that should be addressed for the best user experience.`;
    } else {
      return `Your server has ${report.summary.errors} error(s) that must be fixed before it will work with ChatGPT Apps.`;
    }
  }

  private renderChecks(report: ConformanceReport): string {
    const categories = this.groupByCategory(report.checks);
    let html = '';

    const categoryOrder: Category[] = ['protocol', 'tools', 'resources', 'execution', 'content', 'cross'];

    for (const category of categoryOrder) {
      const categoryChecks = categories[category];
      if (!categoryChecks || categoryChecks.length === 0) continue;

      const title = CATEGORY_TITLES[category] || category;
      const description = CATEGORY_DESCRIPTIONS[category] || '';

      html += `
    <section>
      <div class="section-header">
        <h2>${this.escape(title)}</h2>
        <p>${this.escape(description)}</p>
      </div>
      ${this.renderCategoryChecks(categoryChecks)}
    </section>`;
    }

    return html;
  }

  private renderCategoryChecks(checks: CheckResult[]): string {
    // Group by target
    const byTarget = new Map<string, CheckResult[]>();
    for (const check of checks) {
      const target = check.target || 'General';
      if (!byTarget.has(target)) {
        byTarget.set(target, []);
      }
      byTarget.get(target)!.push(check);
    }

    let html = '';
    for (const [target, targetChecks] of byTarget) {
      const hasIssues = targetChecks.some(c => !c.passed && c.severity !== 'info');
      const badgeClass = hasIssues ? 'has-issues' : 'all-pass';
      const badgeText = hasIssues ? 'Needs attention' : 'All good';

      html += `
      <div class="check-group">
        <div class="check-group-header">
          <span class="check-group-title">${this.escape(target)}</span>
          <span class="check-group-badge ${badgeClass}">${badgeText}</span>
        </div>
        <ul class="check-list">
          ${targetChecks.map(check => this.renderCheckItem(check)).join('')}
        </ul>
      </div>`;
    }

    return html;
  }

  private renderCheckItem(check: CheckResult): string {
    const iconClass = check.passed ? 'pass' : (check.severity === 'error' ? 'fail' : check.severity === 'warn' ? 'warn' : 'info');
    const icon = check.passed ? '✓' : (check.severity === 'error' ? '✗' : check.severity === 'warn' ? '!' : 'i');

    const title = CHECK_DESCRIPTIONS[check.id] || check.message;
    const detail = check.passed ? check.message : '';

    let suggestionHtml = '';
    if (!check.passed && check.suggestion) {
      suggestionHtml = `
          <div class="suggestion">
            <div class="suggestion-label">How to fix</div>
            ${this.escape(check.suggestion)}
          </div>`;
    }

    return `
          <li class="check-item">
            <span class="check-icon ${iconClass}">${icon}</span>
            <div class="check-content">
              <div class="check-title">${this.escape(title)}</div>
              ${detail ? `<div class="check-detail">${this.escape(detail)}</div>` : ''}
              ${suggestionHtml}
            </div>
          </li>`;
  }

  private renderTools(report: ConformanceReport): string {
    if (report.tools.length === 0) return '';

    const rows = report.tools.map(tool => `
        <tr>
          <td><code>${this.escape(tool.name)}</code></td>
          <td>${this.escape(tool.description || '—')}</td>
          <td><span class="badge ${tool.hasOutputTemplate ? 'yes' : 'no'}">${tool.hasOutputTemplate ? 'Yes' : 'No'}</span></td>
          <td>${tool.outputTemplateUri ? `<code>${this.escape(tool.outputTemplateUri)}</code>` : '—'}</td>
        </tr>`).join('');

    return `
    <section>
      <div class="section-header">
        <h2>Tool Inventory</h2>
        <p>Tools registered by this MCP server</p>
      </div>
      <div class="inventory">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Has Widget</th>
              <th>Widget Template</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>`;
  }

  private renderResources(report: ConformanceReport): string {
    if (report.resources.length === 0) return '';

    const rows = report.resources.map(resource => `
        <tr>
          <td><code>${this.escape(resource.uri)}</code></td>
          <td>${this.escape(resource.name || '—')}</td>
          <td>${resource.isWidget ? '<span class="badge widget">Widget</span>' : '—'}</td>
          <td><code>${this.escape(resource.mimeType || 'unknown')}</code></td>
        </tr>`).join('');

    return `
    <section>
      <div class="section-header">
        <h2>Resource Inventory</h2>
        <p>Resources exposed by this MCP server</p>
      </div>
      <div class="inventory">
        <table>
          <thead>
            <tr>
              <th>URI</th>
              <th>Name</th>
              <th>Type</th>
              <th>MIME Type</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>`;
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
