// ABOUTME: Shared utility functions for reporters.
// ABOUTME: Deduplicates common logic across text, markdown, HTML, and JUnit reporters.

import type { CheckResult } from '../types/check.js';

/** Group check results by their category field. */
export function groupByCategory(checks: CheckResult[]): Record<string, CheckResult[]> {
  const groups: Record<string, CheckResult[]> = {};
  for (const check of checks) {
    if (!groups[check.category]) {
      groups[check.category] = [];
    }
    groups[check.category].push(check);
  }
  return groups;
}

/** Escape special characters for safe inclusion in HTML/XML. */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
