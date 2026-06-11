"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Theme preference control. "system" follows the OS (no stored value); "light"
 * / "dark" pin and persist. The no-flash inline script in the root layout reads
 * the same localStorage key on load, so this only needs to handle live changes.
 * The .dark token set is AA-checked, so theming is a pure token swap.
 */

type Theme = "system" | "light" | "dark";
const OPTIONS: Theme[] = ["system", "light", "dark"];

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  // Server + first client render agree on "system"; the stored value is read
  // after mount (suppressHydrationWarning on <html> covers the class itself).
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme((localStorage.getItem("theme") as Theme | null) ?? "system");
  }, []);

  // While in system mode, track live OS changes.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    if (next === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", next);
    applyTheme(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-md border border-input p-0.5"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={theme === opt}
          onClick={() => choose(opt)}
          className={cn(
            "rounded px-3 py-1.5 text-sm capitalize transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            theme === opt
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
