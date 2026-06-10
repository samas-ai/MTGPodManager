/**
 * Canonical service result shape (see agent_docs/code_patterns.md).
 * Services return errors as values instead of throwing across boundaries, so
 * callers can route failures (e.g. import failure → manual fallback) explicitly.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T = never>(error: string): Result<T> {
  return { ok: false, error };
}
