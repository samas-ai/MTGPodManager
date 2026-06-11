import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthMessage } from "@/components/features/auth/auth-message";
import { PageHeader } from "@/components/ui/page-header";
import { ThemeToggle } from "@/components/features/theme-toggle";
import { updateDisplayName } from "@/lib/services/profile";
import { signOut } from "@/lib/services/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS (profiles_select) lets a user read their own profile row.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6 pb-24 lg:max-w-3xl">
      <PageHeader
        title="Profile"
        actions={
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        }
      />

      <AuthMessage error={searchParams.error} message={searchParams.message} />

      <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Display name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <form action={updateDisplayName} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Name shown to your pod</Label>
              <Input
                id="displayName"
                name="displayName"
                required
                maxLength={40}
                defaultValue={profile?.display_name ?? ""}
              />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>
      </div>

      <Link
        href="/profile/decks"
        className="rounded-md border border-border bg-card p-4 font-medium hover:bg-muted"
      >
        My decks →
      </Link>
    </main>
  );
}
