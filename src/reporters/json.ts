// ABOUTME: Machine-readable JSON output for programmatic consumption.
// ABOUTME: Outputs the complete ConformanceReport structure.

import type { Reporter } from './index.js';
import type { ConformanceReport } from '../types/report.js';

export class JsonReporter implements Reporter {
  format(report: ConformanceReport): string {
    return JSON.stringify(report, null, 2);
  }
}
