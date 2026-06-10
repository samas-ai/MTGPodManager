/** @type {import('next').NextConfig} */

// Safe, app-non-breaking security headers applied to every route. HSTS only
// takes effect over HTTPS (i.e. on Vercel), so it's harmless in local dev.
//
// CSP is production-only: `next dev` needs eval + a localhost HMR websocket,
// so enforcing it there would only break tooling, not protect anyone.
// 'unsafe-inline' for scripts/styles is required by Next 14's inline bootstrap
// (no nonce support without middleware-rendered CSP); the policy still pins
// every network destination. connect-src covers Supabase REST/Auth (https) and
// Realtime (wss). If Scryfall card art ships later (roadmap D1), add
// https://cards.scryfall.io to img-src.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: csp }]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
