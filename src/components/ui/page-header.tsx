import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Consistent page header: a display-font title with an optional back link and a
 * right-aligned actions slot. Replaces the ad-hoc per-page headers so spacing,
 * typography, and the single <h1> are uniform across screens.
 */
export function PageHeader({
  title,
  back,
  actions,
  className,
}: {
  title: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-1", className)}>
      {back ? (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1 rounded text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </div>
    </header>
  );
}
