import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-display text-5xl font-bold text-primary">404</p>
      <h1 className="font-display text-2xl font-bold">Not found</h1>
      <p className="text-sm text-muted-foreground">
        That page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link href="/groups" className={buttonVariants()}>
        Back to your pods
      </Link>
    </main>
  );
}
