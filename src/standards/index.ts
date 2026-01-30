// ABOUTME: Re-exports for the standards module.
// ABOUTME: Entry point for importing standard specifications.

export type { StandardSpec } from './spec.js';
export { OPENAI_STANDARD } from './openai.js';
export { MCP_APPS_STANDARD } from './mcp-apps.js';
export { getPath } from './accessor.js';

import type { StandardSpec } from './spec.js';
import { OPENAI_STANDARD } from './openai.js';
import { MCP_APPS_STANDARD } from './mcp-apps.js';

/** All available standards */
export const STANDARDS: Record<string, StandardSpec> = {
  openai: OPENAI_STANDARD,
  'mcp-apps': MCP_APPS_STANDARD,
};

/** Get a standard by name, or undefined if not found */
export function getStandard(name: string): StandardSpec | undefined {
  return STANDARDS[name];
}

/** Get list of available standard names */
export function getStandardNames(): string[] {
  return Object.keys(STANDARDS);
}
