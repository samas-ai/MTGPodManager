/** @type {import('next').NextConfig} */

// Safe, app-non-breaking security headers applied to every route. HSTS only
// takes effect over HTTPS (i.e. on Vercel), so it's harmless in local dev.
//
// CSP is production-only: `next dev` needs eval + a localhost HMR websocket,
// so enforcing it there would only break tooling, not protect anyone.
// 'unsafe-inline' for scripts/styles is required by Next 14's inline bootstrap
// (no nonce support without middleware-rendered CSP); the policy still pins
// every network destination. connect-src covers Supabase REST/Auth (https) and
// Realtime (wss). img-src allows https://cards.scryfall.io for commander art
// (D1) — next/image serves optimized art from 'self', but this covers any
// direct/unoptimized rendering too.
// CI E2E runs the prod build against the LOCAL Supabase stack; this env var
// (unset everywhere else) lets the workflow allow it without touching the
// real policy. Example: "http://127.0.0.1:54321 ws://127.0.0.1:54321".
const extraConnectSrc = process.env.CSP_EXTRA_CONNECT_SRC?.trim();

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://cards.scryfall.io",
  "font-src 'self'",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${
    extraConnectSrc ? ` ${extraConnectSrc}` : ""
  }`,
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
  images: {
    // Commander art (Scryfall). next/image fetches + optimizes server-side and
    // serves from our own origin, so the browser stays within CSP 'self'.
    remotePatterns: [{ protocol: "https", hostname: "cards.scryfall.io" }],
    // Smaller payloads (AVIF→WebP) → faster image LCP; cache the optimized
    // output a day so repeat visits don't re-encode (Scryfall art is immutable).
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
