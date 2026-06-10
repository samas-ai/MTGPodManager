"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("[app] route error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred. You can try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
