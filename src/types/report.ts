// ABOUTME: Aggregate report structure containing all validation results.
// ABOUTME: This is the final output produced by the validation pipeline.

import type { CheckResult } from './check.js';

export type Verdict =
  | 'conformant'              // All checks passed
  | 'conformant_with_warnings' // No errors, but has warnings
  | 'non_conformant';          // Has errors

export interface ServerInfo {
  name?: string;
  version?: string;
  protocolVersion?: string;
}

export interface ToolInfo {
  name: string;
  description?: string;
  hasOutputTemplate: boolean;
  outputTemplateUri?: string;
}

export interface ResourceInfo {
  uri: string;
  name?: string;
  mimeType?: string;
  isWidget: boolean;
}

export interface ConformanceReport {
  serverUrl: string;
  timestamp: string;
  durationMs: number;

  serverInfo: ServerInfo;

  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    errors: number;
    info: number;
    toolCount: number;
    resourceCount: number;
  };

  verdict: Verdict;
  checks: CheckResult[];
  tools: ToolInfo[];
  resources: ResourceInfo[];
}
