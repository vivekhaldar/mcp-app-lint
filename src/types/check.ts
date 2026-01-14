// ABOUTME: Core data structures for validation check results.
// ABOUTME: Used throughout the codebase to represent individual check outcomes.

export type Severity = 'error' | 'warn' | 'info';

export type Category =
  | 'protocol'   // CONN_*, PROTO_*
  | 'tools'      // TOOL_*
  | 'resources'  // RES_*
  | 'execution'  // EXEC_*
  | 'content'    // READ_*
  | 'cross';     // XVAL_*

export interface CheckResult {
  /** Unique check identifier, e.g., "TOOL_007" */
  id: string;

  /** Which validation phase this check belongs to */
  category: Category;

  /** How critical is this check? */
  severity: Severity;

  /** Did the check pass? */
  passed: boolean;

  /** What was being checked (tool name, resource URI, etc.) */
  target?: string;

  /** Human-readable description of what was checked */
  message: string;

  /** Additional context: actual values found, expected values, etc. */
  details?: unknown;

  /** Actionable fix suggestion if check failed */
  suggestion?: string;

  /** Link to relevant documentation */
  specRef?: string;
}
