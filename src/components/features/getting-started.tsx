import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface OnboardingStep {
  label: string;
  done: boolean;
  /** What to do next — shown only while the step is incomplete. */
  hint: string;
  /** If set, the hint links here; otherwise it's plain guidance. */
  href?: string;
}

/**
 * First-run guidance: a small checklist that adapts to pod state and teaches the
 * next action instead of leaving the screen empty. Renders nothing once every
 * step is done. Color is never the sole signal — completed steps carry a ✓ glyph
 * and strike-through, not just the success color.
 */
export function GettingStarted({ steps }: { steps: OnboardingStep[] }) {
  const remaining = steps.filter((s) => !s.done).length;
  if (remaining === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">A few steps to get your pod rolling.</p>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-start gap-2 text-sm">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none",
                  s.done
                    ? "border-success bg-success text-success-foreground"
                    : "border-border text-transparent",
                )}
              >
                ✓
              </span>
              <span className={s.done ? "text-muted-foreground line-through" : ""}>
                <span className="font-medium">{s.label}</span>
                {!s.done ? (
                  <>
                    {" — "}
                    {s.href ? (
                      <Link href={s.href} className="underline underline-offset-2">
                        {s.hint}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{s.hint}</span>
                    )}
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
