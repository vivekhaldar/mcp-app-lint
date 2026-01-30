import { describe, it, expect } from 'vitest';
import { ReporterFactory } from '../../src/reporters/index.js';
import { TextReporter } from '../../src/reporters/text.js';
import { JsonReporter } from '../../src/reporters/json.js';
import { MarkdownReporter } from '../../src/reporters/markdown.js';
import { JUnitReporter } from '../../src/reporters/junit.js';
import { HtmlReporter } from '../../src/reporters/html.js';
import type { ConformanceReport } from '../../src/types/report.js';
import type { CheckResult } from '../../src/types/check.js';

function makeReport(overrides: Partial<ConformanceReport> = {}): ConformanceReport {
  return {
    serverUrl: 'http://localhost:3000/mcp',
    timestamp: '2025-01-01T00:00:00.000Z',
    durationMs: 1234,
    standard: 'openai',
    standardName: 'OpenAI Apps SDK',
    specRef: 'https://example.com/spec',
    serverInfo: { name: 'test-server', version: '1.0', protocolVersion: '2024-11-05' },
    summary: {
      totalChecks: 3,
      passed: 2,
      warnings: 1,
      errors: 0,
      info: 0,
      toolCount: 1,
      resourceCount: 1,
    },
    verdict: 'conformant_with_warnings',
    checks: [
      { id: 'CONN_001', category: 'protocol', severity: 'error', passed: true, message: 'Server responds' },
      { id: 'TOOL_003', category: 'tools', severity: 'error', passed: true, message: 'Has description', target: 'my_tool' },
      { id: 'TOOL_004', category: 'tools', severity: 'warn', passed: false, message: 'Description too short', target: 'my_tool', suggestion: 'Add a longer description' },
    ],
    tools: [{ name: 'my_tool', description: 'desc', hasOutputTemplate: true, outputTemplateUri: 'ui://widget/app.html' }],
    resources: [{ uri: 'ui://widget/app.html', name: 'App', mimeType: 'text/html+skybridge', isWidget: true }],
    ...overrides,
  };
}

describe('ReporterFactory', () => {
  it('creates TextReporter', async () => {
    const reporter = await ReporterFactory.create('text');
    expect(reporter).toBeInstanceOf(TextReporter);
  });

  it('creates JsonReporter', async () => {
    const reporter = await ReporterFactory.create('json');
    expect(reporter).toBeInstanceOf(JsonReporter);
  });

  it('creates MarkdownReporter', async () => {
    const reporter = await ReporterFactory.create('markdown');
    expect(reporter).toBeInstanceOf(MarkdownReporter);
  });

  it('creates HtmlReporter', async () => {
    const reporter = await ReporterFactory.create('html');
    expect(reporter).toBeInstanceOf(HtmlReporter);
  });

  it('creates JUnitReporter', async () => {
    const reporter = await ReporterFactory.create('junit');
    expect(reporter).toBeInstanceOf(JUnitReporter);
  });

  it('throws for unknown format', async () => {
    await expect(ReporterFactory.create('csv' as any)).rejects.toThrow('Unknown report format');
  });
});

describe('JsonReporter', () => {
  const reporter = new JsonReporter();

  it('outputs valid JSON', () => {
    const report = makeReport();
    const output = reporter.format(report);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('includes all report fields', () => {
    const report = makeReport();
    const output = reporter.format(report);
    const parsed = JSON.parse(output);
    expect(parsed.serverUrl).toBe('http://localhost:3000/mcp');
    expect(parsed.verdict).toBe('conformant_with_warnings');
    expect(parsed.checks).toHaveLength(3);
    expect(parsed.summary.totalChecks).toBe(3);
  });

  it('is pretty-printed with 2-space indent', () => {
    const report = makeReport();
    const output = reporter.format(report);
    expect(output).toBe(JSON.stringify(report, null, 2));
  });
});

describe('TextReporter', () => {
  const reporter = new TextReporter();

  it('includes header with standard name', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('OpenAI Apps SDK');
  });

  it('includes server URL', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('http://localhost:3000/mcp');
  });

  it('includes summary counts', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('Total Checks: 3');
    expect(output).toContain('Passed: 2');
  });

  it('includes verdict', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('VERDICT');
    expect(output).toContain('CONFORMANT WITH WARNINGS');
  });

  it('includes check messages', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('Server responds');
    expect(output).toContain('Description too short');
  });

  it('includes suggestion for failed checks', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('Add a longer description');
  });

  it('handles empty checks', () => {
    const report = makeReport({ checks: [], summary: { ...makeReport().summary, totalChecks: 0, passed: 0, warnings: 0 } });
    const output = reporter.format(report);
    expect(output).toContain('Total Checks: 0');
  });
});

describe('MarkdownReporter', () => {
  const reporter = new MarkdownReporter();

  it('starts with H1 heading', () => {
    const output = reporter.format(makeReport());
    expect(output).toMatch(/^# /);
  });

  it('includes summary table', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('| Metric | Count |');
    expect(output).toContain('| Total Checks | 3 |');
  });

  it('includes verdict with emoji', () => {
    const output = reporter.format(makeReport({ verdict: 'conformant' }));
    expect(output).toContain('✅');
    expect(output).toContain('CONFORMANT');
  });

  it('uses warning emoji for warnings', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('⚠️');
  });

  it('uses error emoji for non-conformant', () => {
    const output = reporter.format(makeReport({ verdict: 'non_conformant' }));
    expect(output).toContain('❌');
  });

  it('includes check tables with status', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('| Status | ID | Target | Message |');
  });

  it('includes suggestions section for failures', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('### Suggestions');
    expect(output).toContain('Add a longer description');
  });
});

describe('JUnitReporter', () => {
  const reporter = new JUnitReporter();

  it('outputs valid XML structure', () => {
    const output = reporter.format(makeReport());
    expect(output).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(output).toContain('<testsuite');
    expect(output).toContain('</testsuite>');
  });

  it('includes test count and failure count', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('tests="3"');
    expect(output).toContain('failures="1"'); // 1 warning failure
  });

  it('includes duration in seconds', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('time="1.234"');
  });

  it('creates testcase elements for each check', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('<testcase');
    const testcaseCount = (output.match(/<testcase /g) || []).length;
    expect(testcaseCount).toBe(3);
  });

  it('includes failure element for failed checks', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('<failure type="warning"');
    expect(output).toContain('Description too short');
  });

  it('includes suggestion in failure text', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('Suggestion: Add a longer description');
  });

  it('escapes XML special characters', () => {
    const checks: CheckResult[] = [
      { id: 'TEST', category: 'protocol', severity: 'error', passed: false, message: 'Value <script> & "quotes"' },
    ];
    const report = makeReport({
      checks,
      summary: { totalChecks: 1, passed: 0, warnings: 0, errors: 1, info: 0, toolCount: 0, resourceCount: 0 },
    });
    const output = reporter.format(report);
    expect(output).toContain('&lt;script&gt;');
    expect(output).toContain('&amp;');
    expect(output).toContain('&quot;quotes&quot;');
  });

  it('uses classname based on category', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('classname="conformance.protocol"');
    expect(output).toContain('classname="conformance.tools"');
  });

  it('uses target in testcase name when present', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('name="TOOL_003: my_tool"');
  });

  it('uses just ID when no target', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('name="CONN_001"');
  });
});

describe('HtmlReporter', () => {
  const reporter = new HtmlReporter();

  it('outputs valid HTML5 document', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<html');
    expect(output).toContain('</html>');
  });

  it('includes standard name in title', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('OpenAI Apps SDK');
  });

  it('includes verdict section', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('Conformant with Warnings');
  });

  it('includes check results', () => {
    const output = reporter.format(makeReport());
    // HTML reporter uses human-readable descriptions from CHECK_DESCRIPTIONS map
    expect(output).toContain('Server responds to HTTP');
    expect(output).toContain('Tool description is meaningful');
  });

  it('escapes HTML special characters in messages', () => {
    const checks: CheckResult[] = [
      { id: 'TEST', category: 'protocol', severity: 'error', passed: true, message: 'Value <script>alert("xss")</script>' },
    ];
    const report = makeReport({ checks });
    const output = reporter.format(report);
    expect(output).not.toContain('<script>alert("xss")</script>');
    expect(output).toContain('&lt;script&gt;');
  });

  it('includes tool inventory', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('my_tool');
  });

  it('includes resource inventory', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('ui://widget/app.html');
  });

  it('includes CSS styles', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('<style>');
  });

  it('includes JavaScript for filtering', () => {
    const output = reporter.format(makeReport());
    expect(output).toContain('<script>');
    expect(output).toContain('applyFilters');
  });

  it('handles all verdict types', () => {
    // HTML reporter uses human-readable verdict text
    const verdictMap: Record<string, string> = {
      conformant: 'Fully Conformant',
      conformant_with_warnings: 'Conformant with Warnings',
      non_conformant: 'Not Conformant',
    };
    for (const verdict of ['conformant', 'conformant_with_warnings', 'non_conformant'] as const) {
      const output = reporter.format(makeReport({ verdict }));
      expect(output).toContain(verdictMap[verdict]);
    }
  });

  it('handles empty tools and resources', () => {
    const report = makeReport({ tools: [], resources: [] });
    const output = reporter.format(report);
    expect(output).toContain('<!DOCTYPE html>');
  });
});
