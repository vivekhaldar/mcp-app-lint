// ABOUTME: Orchestrates the validation pipeline, running validators in sequence.
// ABOUTME: Manages shared context and aggregates all check results.

import type { MCPClient, Tool, Resource, ToolCallResult, ResourceContent } from '../client/mcp.js';
import type { CheckResult } from '../types/check.js';
import type { Validator } from './base.js';

export interface ValidatorConfig {
  /** Only check these tools (empty = all) */
  toolFilter: string[];
  /** Skip tool execution phase (DEFAULT: true for safety) */
  skipExecution: boolean;
  /** Only execute tools with readOnlyHint=true */
  executeSafeOnly: boolean;
  /** Skip content validation phase */
  skipContent: boolean;
  /** Request timeout in ms */
  timeout: number;
  /** Verbose output */
  verbose: boolean;
}

export interface ValidationContext {
  client: MCPClient;
  config: ValidatorConfig;

  // Accumulated data from each phase
  serverInfo?: {
    name?: string;
    version?: string;
    protocolVersion?: string;
  };
  tools?: Tool[];
  resources?: Resource[];
  toolResponses?: Map<string, ToolCallResult>;
  resourceContents?: Map<string, ResourceContent>;
}

export async function runValidationPipeline(
  client: MCPClient,
  config: ValidatorConfig,
  validators: Validator[],
  ctx?: ValidationContext
): Promise<CheckResult[]> {
  // Use provided context or create a new one
  const validationCtx: ValidationContext = ctx ?? { client, config };
  const allResults: CheckResult[] = [];

  for (const validator of validators) {
    const results = await validator.run(validationCtx);
    allResults.push(...results);

    // If protocol validation fails with errors, stop early
    if (validator.name === 'protocol') {
      const hasErrors = results.some(r => r.severity === 'error' && !r.passed);
      if (hasErrors) {
        break;
      }
    }
  }

  return allResults;
}
