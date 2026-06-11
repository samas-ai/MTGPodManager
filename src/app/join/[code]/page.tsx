import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { joinGroup } from "@/lib/services/groups";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Join a pod" };

/**
 * Invite-QR landing. A scanned QR encodes /join/<code>; an authed user confirms
 * and joins (via the existing joinGroup RPC action); an anonymous user is sent
 * to sign in and returned here afterwards (next param, open-redirect-guarded by
 * safePath in the auth actions).
 */
export default async function JoinByCodePage({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(`/join/${code}`);
    const message = encodeURIComponent("Sign in to join the pod.");
    redirect(`/sign-in?next=${next}&message=${message}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <PageHeader title="Join a pod" />
      <Card>
        <CardHeader>
          <CardTitle>You&apos;re invited</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Join the pod with invite code{" "}
            <span className="font-mono tracking-widest text-foreground">{code}</span>?
          </p>
          <form action={joinGroup}>
            <input type="hidden" name="code" value={code} />
            <Button type="submit" className="w-full">
              Join pod
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
