import type { MetadataRoute } from "next";

// Only the landing page is public; the rest is auth-gated (and returns nothing
// useful without a session), so allowing crawl is safe.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
