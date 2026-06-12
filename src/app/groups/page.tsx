import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthMessage } from "@/components/features/auth/auth-message";
import { PageHeader } from "@/components/ui/page-header";
import { createGroup, joinGroup } from "@/lib/services/groups";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your pods" };

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS (groups_select_member) scopes this to groups the user belongs to.
  const { data: groups, error } = await supabase
    .from("groups")
    .select("id, name")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6 pb-24 lg:max-w-4xl">
      <PageHeader title="Your pods" />

      <AuthMessage error={searchParams.error} />

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {groups && groups.length > 0 ? (
          groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="rounded-md border border-border bg-card p-4 font-medium hover:bg-muted"
            >
              {g.name}
            </Link>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            <p className="font-medium text-foreground">Welcome — let&apos;s get your pod going.</p>
            <p className="mt-1">
              Spin up your first pod below, or join an existing one with an invite code. Then
              register a deck and you&apos;re ready to log games.
            </p>
          </div>
        )}
      </section>

      <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Create a pod</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createGroup} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Pod name</Label>
              <Input id="name" name="name" required maxLength={60} placeholder="Tuesday Night EDH" />
            </div>
            <Button type="submit">Create pod</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Join a pod</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={joinGroup} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">Invite code</Label>
              <Input id="code" name="code" required placeholder="ABCD1234" autoCapitalize="characters" />
            </div>
            <Button type="submit" variant="outline">
              Join pod
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
