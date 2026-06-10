/**
 * Returns `value` only if it is a safe internal, same-origin relative path;
 * otherwise returns `fallback`. Rejects non-strings, anything not starting with
 * "/", protocol-relative ("//host"), and backslash-prefixed ("/\\host") values
 * that browsers resolve as external — preventing open-redirect via user input.
 */
export function safePath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
