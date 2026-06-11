import { Skeleton } from "@/components/ui/skeleton";

/** Shared loading placeholder matching the app's page shell. */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
      <span className="sr-only">Shuffling up…</span>
    </main>
  );
}
