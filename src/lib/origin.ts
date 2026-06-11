import { headers } from "next/headers";

/**
 * Absolute origin of the current request (e.g. "https://pods.example.com"),
 * derived from forwarding headers so QR-encoded links are correct on any
 * deployment without depending on an env var. Falls back to localhost in dev.
 */
export function getOrigin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
