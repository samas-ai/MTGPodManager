import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthMessage } from "@/components/features/auth/auth-message";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { QrCode } from "@/components/features/qr-code";
import { DeletePod } from "@/components/features/group/delete-pod";
import { Input } from "@/components/ui/input";
import {
  createInvite,
  leaveGroup,
  removeMember,
  renameGroup,
  revokeInvites,
  setAdmin,
} from "@/lib/services/groups";
import { cancelMatch, rematch, startMatch } from "@/lib/services/matches";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/origin";
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
  const roster = members ?? [];
  const isAdmin = roster.some((m) => m.user_id === user.id && m.role === "admin");

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
  const lastFinalized = recentMatches[0] ?? null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6 pb-24 lg:max-w-5xl">
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

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
      {searchParams.invite ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite code</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <p className="font-mono text-2xl tracking-widest">{searchParams.invite}</p>
            <QrCode
              value={`${getOrigin()}/join/${searchParams.invite}`}
              label="Scan to join this pod"
              size={180}
            />
            <p className="text-center text-sm text-muted-foreground">
              Scan to join, or share the code. Expires in 14 days.
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
            {roster.map((m) => {
              const isSelf = m.user_id === user.id;
              const memberIsAdmin = m.role === "admin";
              return (
                <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <span className="truncate">
                      {nameById.get(m.user_id) ?? "Unknown player"}
                      {isSelf ? " (you)" : ""}
                    </span>
                    {memberIsAdmin ? <Badge variant="admin">admin</Badge> : null}
                  </span>
                  {isAdmin && !isSelf ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <form action={setAdmin}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="userId" value={m.user_id} />
                        <input type="hidden" name="makeAdmin" value={memberIsAdmin ? "false" : "true"} />
                        <Button type="submit" variant="ghost" size="sm">
                          {memberIsAdmin ? "Demote" : "Make admin"}
                        </Button>
                      </form>
                      <form action={removeMember}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <input type="hidden" name="userId" value={m.user_id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Remove
                        </Button>
                      </form>
                    </span>
                  ) : null}
                </li>
              );
            })}
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
              <div className="flex flex-wrap items-center gap-2">
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
                {isAdmin || openMatch.host_id === user.id ? (
                  <form action={cancelMatch}>
                    <input type="hidden" name="matchId" value={openMatch.id} />
                    <input type="hidden" name="redirectTo" value={`/groups/${group.id}`} />
                    <Button type="submit" variant="outline">
                      Close match
                    </Button>
                  </form>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Untap, shuffle up, and let your pod join — you&apos;ll run the table&apos;s life
                counter.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <form action={startMatch}>
                  <input type="hidden" name="groupId" value={group.id} />
                  <Button type="submit">Start match</Button>
                </form>
                {lastFinalized ? (
                  <form action={rematch}>
                    <input type="hidden" name="fromMatchId" value={lastFinalized.id} />
                    <Button type="submit" variant="outline">
                      Run it back
                    </Button>
                  </form>
                ) : null}
              </div>
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
              No games chronicled yet. Standings appear after your first match.
            </p>
          ) : (
            <ol className="space-y-1">
              {topStandings.slice(0, 3).map((s, i) => (
                <li
                  key={s.userId}
                  className={cn(
                    "flex items-center justify-between rounded-md text-sm",
                    i === 0 && "mtg-foil border-l-2 border-accent py-1 pl-2 font-medium",
                  )}
                >
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
          <CardTitle>Chronicle</CardTitle>
        </CardHeader>
        <CardContent>
          {recentMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No games chronicled yet.</p>
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

      {/* Manage pod — admins only (RPCs re-check authorization regardless). */}
      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Manage pod</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={renameGroup} className="flex items-end gap-2">
              <input type="hidden" name="groupId" value={group.id} />
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="rename" className="text-sm font-medium">
                  Pod name
                </label>
                <Input id="rename" name="name" required maxLength={60} defaultValue={group.name} />
              </div>
              <Button type="submit" variant="outline">
                Rename
              </Button>
            </form>
            <form action={revokeInvites}>
              <input type="hidden" name="groupId" value={group.id} />
              <Button type="submit" variant="outline" size="sm">
                Revoke invite codes
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* Danger zone — admin-only, irreversible (delete_group re-checks admin). */}
      {isAdmin ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <DeletePod groupId={group.id} groupName={group.name} />
          </CardContent>
        </Card>
      ) : null}
      </div>

      {/* Leave pod — available to everyone; the sole admin is blocked server-side. */}
      <form action={leaveGroup}>
        <input type="hidden" name="groupId" value={group.id} />
        <Button type="submit" variant="ghost" size="sm" className="self-start text-destructive">
          Leave pod
        </Button>
      </form>
    </main>
  );
}
