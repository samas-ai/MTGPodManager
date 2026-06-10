/** @type {import('next').NextConfig} */

// Safe, app-non-breaking security headers applied to every route. HSTS only
// takes effect over HTTPS (i.e. on Vercel), so it's harmless in local dev.
//
// NOTE on CSP: a Content-Security-Policy is intentionally NOT enabled here yet.
// A correct policy must allow self-hosted next/font, Supabase REST/Auth over
// https://*.supabase.co, and Realtime over wss://*.supabase.co, and Next injects
// some inline bootstrap styles/scripts. Enable it after verifying in a real
// browser that Realtime + fonts + styles still work. Starting template:
//   key: "Content-Security-Policy",
//   value: [
//     "default-src 'self'",
//     "script-src 'self' 'unsafe-inline'",
//     "style-src 'self' 'unsafe-inline'",
//     "img-src 'self' data:",
//     "font-src 'self'",
//     "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
//     "frame-ancestors 'none'",
//   ].join("; "),
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
