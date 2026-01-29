// ABOUTME: Path accessor utility for resolving nested field values.
// ABOUTME: Handles dot-notation paths like "_meta.ui.resourceUri".

/**
 * Resolve a dot-notation path to a value in an object.
 *
 * @param obj - The object to traverse
 * @param path - Dot-notation path (e.g., "_meta.ui.resourceUri" or "_meta.openai/outputTemplate")
 * @returns The value at the path, or undefined if not found
 *
 * @example
 * getPath({ _meta: { "openai/outputTemplate": "ui://widget/foo.html" } }, "_meta.openai/outputTemplate")
 * // returns "ui://widget/foo.html"
 */
export function getPath(obj: unknown, path: string): unknown {
  if (!path || typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Check if a path exists and has a truthy value.
 */
export function hasPath(obj: unknown, path: string): boolean {
  const value = getPath(obj, path);
  return value !== undefined && value !== null;
}

/**
 * Get a path value typed as a specific type.
 * Returns undefined if the path doesn't exist or value isn't the expected type.
 */
export function getTypedPath<T>(
  obj: unknown,
  path: string,
  typeGuard: (v: unknown) => v is T
): T | undefined {
  const value = getPath(obj, path);
  return typeGuard(value) ? value : undefined;
}

/**
 * Type guard for string values.
 */
export function isString(v: unknown): v is string {
  return typeof v === 'string';
}

/**
 * Type guard for Record<string, unknown>.
 */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Type guard for arrays.
 */
export function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}
