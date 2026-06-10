import Script from "next/script";

/**
 * Vercel Web Analytics + Speed Insights via their first-party scripts instead
 * of @vercel/analytics / @vercel/speed-insights (whose optional-peer chains
 * conflict with Vitest 2's vite@5 pin). The scripts are what those packages
 * inject for the App Router: same-origin (`/_vercel/...`, covered by CSP
 * 'self'), auto-tracking page views across client navigations.
 *
 * They are only served on Vercel deployments with Web Analytics / Speed
 * Insights enabled in the dashboard, so this renders nothing off-Vercel
 * (local dev AND local prod builds) to keep consoles free of 404 noise.
 */
export function VercelMetrics() {
  if (process.env.VERCEL !== "1") return null;
  return (
    <>
      <Script src="/_vercel/insights/script.js" strategy="lazyOnload" data-sdkn="inline" />
      <Script src="/_vercel/speed-insights/script.js" strategy="lazyOnload" data-sdkn="inline" />
    </>
  );
}
