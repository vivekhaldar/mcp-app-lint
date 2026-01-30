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
