import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import { VercelMetrics } from "@/components/features/vercel-metrics";
import { BottomNav } from "@/components/features/nav/bottom-nav";
import { ActiveMatchPill } from "@/components/features/nav/active-match-pill";
import { Footer } from "@/components/features/footer";
import "@/styles/globals.css";

// Display serif (Trajan-like, very MTG) for headings; clean sans for body.
// next/font self-hosts the files at build time — no runtime requests.
const display = Cinzel({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "MTG Pod Manager", template: "%s · MTG Pod Manager" },
  description: "Persistent, participation-verified league stats for your Commander pod.",
  openGraph: {
    title: "MTG Pod Manager",
    description: "Persistent, participation-verified league stats for your Commander pod.",
    type: "website",
  },
};

// Mobile-first: phones are used around the table.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#5b3fa6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {/* Apply the saved (or OS) theme before paint to avoid a flash. Inline by
            necessity; allowed by the CSP's script-src 'unsafe-inline'. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();",
          }}
        />
        {/* Skip link for keyboard / screen-reader users (WCAG 2.4.1). */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <div id="main">{children}</div>
        <Footer />
        <ActiveMatchPill />
        <BottomNav />
        <VercelMetrics />
      </body>
    </html>
  );
}
