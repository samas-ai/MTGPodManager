import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-in users go straight to their pods.
  if (user) redirect("/groups");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">MTG Pod Manager</h1>
        <p className="text-muted-foreground">
          A persistent league for your Commander pod — verified match logging and standings that
          last.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <Link href="/sign-up" className={buttonVariants()}>
          Create an account
        </Link>
        <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
          Sign in
        </Link>
      </div>
    </main>
  );
}
