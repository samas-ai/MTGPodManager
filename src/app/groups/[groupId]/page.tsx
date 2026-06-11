import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthMessage } from "@/components/features/auth/auth-message";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { createInvite } from "@/lib/services/groups";
import { startMatch } from "@/lib/services/matches";
import { createClient } from "@/lib/supabase/server";
import { getRecentMatches, getStandings } from "@/lib/stats";

export const metadata = { title: "Pod" };

export default async function GroupHomePage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams: { invite?: string; error?: string; message?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS returns the row only if the caller is a member; otherwise null -> 404.
  const { data: group } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", params.groupId)
    .maybeSingle();

  if (!group) notFound();

  // Roster + member display names. Two scoped reads (profiles_select allows
  // reading co-members) keeps typing simple and avoids embedded-join inference.
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, role, joined_at")
    .eq("group_id", group.id)
    .order("joined_at", { ascending: true });

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", memberIds)
    : { data: [] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  // Most recent open match (if any) for live-match discovery.
  const { data: openMatch } = await supabase
    .from("matches")
    .select("id, host_id")
    .eq("group_id", group.id)
    .eq("status", "open")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Compact stats teasers (full breakdown lives at /stats/[groupId]).
  const [topStandings, recentMatches] = await Promise.all([
    getStandings(supabase, group.id),
    getRecentMatches(supabase, group.id, 3),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6 pb-24">
      <PageHeader
        title={group.name}
        back={{ href: "/groups", label: "All pods" }}
        actions={
          <Link href={`/stats/${group.id}`} className="px-2 text-sm text-muted-foreground underline">
            Stats
          </Link>
        }
      />

      <AuthMessage error={searchParams.error} message={searchParams.message} />

      {searchParams.invite ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="font-mono text-2xl tracking-widest">{searchParams.invite}</p>
            <p className="text-sm text-muted-foreground">
              Share this code. It expires in 14 days.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Members ({members?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="space-y-1">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between text-sm">
                <span>{nameById.get(m.user_id) ?? "Unknown player"}</span>
                {m.role === "admin" ? <Badge variant="admin">admin</Badge> : null}
              </li>
            ))}
          </ul>
          <form action={createInvite} className="pt-2">
            <input type="hidden" name="groupId" value={group.id} />
            <Button type="submit" variant="outline" size="sm">
              Generate invite code
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live match</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {openMatch ? (
            <>
              <p className="text-sm text-muted-foreground">A match is in progress.</p>
              <Link
                href={
                  openMatch.host_id === user.id
                    ? `/match/${openMatch.id}/host`
                    : `/match/${openMatch.id}/join`
                }
                className={buttonVariants()}
              >
                {openMatch.host_id === user.id ? "Open host screen" : "Join match"}
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Host a session: run the table&apos;s life counter and let your pod join.
              </p>
              <form action={startMatch}>
                <input type="hidden" name="groupId" value={group.id} />
                <Button type="submit">Start match</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Standings</span>
            <Link
              href={`/stats/${group.id}`}
              className="text-sm font-normal text-muted-foreground underline"
            >
              Full stats →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topStandings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No finalized matches yet. Standings appear after your first match.
            </p>
          ) : (
            <ol className="space-y-1">
              {topStandings.slice(0, 3).map((s, i) => (
                <li key={s.userId} className="flex items-center justify-between text-sm">
                  <span>
                    {i + 1}. {s.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {s.pct}% · {s.wins}/{s.games}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent matches</CardTitle>
        </CardHeader>
        <CardContent>
          {recentMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No finalized matches yet.</p>
          ) : (
            <ul className="space-y-1">
              {recentMatches.map((m) => (
                <li key={m.id} className="text-sm">
                  {m.winnerName ? `${m.winnerName} won` : "Finalized"}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
