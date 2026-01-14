// ABOUTME: Terminal-friendly text output with ANSI colors.
// ABOUTME: Default output format for interactive CLI usage.

import chalk from 'chalk';
import type { Reporter } from './index.js';
import type { ConformanceReport } from '../types/report.js';
import type { CheckResult } from '../types/check.js';

export class TextReporter implements Reporter {
  format(report: ConformanceReport): string {
    const lines: string[] = [];

    // Header
    lines.push(chalk.bold('ChatGPT Apps SDK Conformance Report'));
    lines.push('='.repeat(70));
    lines.push('');
    lines.push(`Server: ${report.serverUrl}`);
    if (report.serverInfo.protocolVersion) {
      lines.push(`Protocol Version: ${report.serverInfo.protocolVersion}`);
    }
    if (report.serverInfo.name) {
      lines.push(`Server Name: ${report.serverInfo.name}`);
    }
    lines.push(`Tools: ${report.summary.toolCount}`);
    lines.push(`Resources: ${report.summary.resourceCount}`);
    lines.push('');

    // Group checks by category
    const categories = this.groupByCategory(report.checks);

    for (const [category, checks] of Object.entries(categories)) {
      lines.push('='.repeat(70));
      lines.push(chalk.bold(category.toUpperCase() + ' CHECKS'));
      lines.push('='.repeat(70));
      lines.push('');

      // Group by target within category
      const byTarget = this.groupByTarget(checks);

      for (const [target, targetChecks] of Object.entries(byTarget)) {
        const allPassed = targetChecks.every(c => c.passed);
        const icon = allPassed ? chalk.green('[PASS]') : chalk.red('[FAIL]');
        lines.push(`${icon} ${target || 'General'}`);

        for (const check of targetChecks) {
          const statusIcon = this.getStatusIcon(check);
          lines.push(`   +-- ${statusIcon} ${check.message}`);
          if (check.details) {
            const detailStr = JSON.stringify(check.details);
            if (detailStr.length < 60) {
              lines.push(`   |     +-- ${chalk.dim(detailStr)}`);
            }
          }
          if (!check.passed && check.suggestion) {
            lines.push(`   |     +-- ${chalk.yellow('Fix: ' + check.suggestion)}`);
          }
        }
        lines.push('');
      }
    }

    // Summary
    lines.push('='.repeat(70));
    lines.push(chalk.bold('SUMMARY'));
    lines.push('='.repeat(70));
    lines.push('');
    lines.push(`Total Checks: ${report.summary.totalChecks}`);
    lines.push(`${chalk.green('[PASS]')} Passed: ${report.summary.passed}`);
    lines.push(`${chalk.blue('[INFO]')}  Info: ${report.summary.info}`);
    lines.push(`${chalk.yellow('[WARN]')}  Warnings: ${report.summary.warnings}`);
    lines.push(`${chalk.red('[FAIL]')} Errors: ${report.summary.errors}`);
    lines.push('');

    // Verdict
    const verdictColor = report.verdict === 'conformant' ? chalk.green
      : report.verdict === 'conformant_with_warnings' ? chalk.yellow
      : chalk.red;
    lines.push(`VERDICT: ${verdictColor(report.verdict.toUpperCase().replace(/_/g, ' '))}`);

    return lines.join('\n');
  }

  private getStatusIcon(check: CheckResult): string {
    if (check.passed) {
      return check.severity === 'info' ? chalk.blue('[INFO]') : chalk.green('[PASS]');
    } else {
      switch (check.severity) {
        case 'error': return chalk.red('[FAIL]');
        case 'warn': return chalk.yellow('[WARN]');
        case 'info': return chalk.blue('[INFO]');
      }
    }
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

  private groupByTarget(checks: CheckResult[]): Record<string, CheckResult[]> {
    const groups: Record<string, CheckResult[]> = {};
    for (const check of checks) {
      const target = check.target || '';
      if (!groups[target]) {
        groups[target] = [];
      }
      groups[target].push(check);
    }
    return groups;
  }
}
