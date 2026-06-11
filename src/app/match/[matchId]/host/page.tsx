import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthMessage } from "@/components/features/auth/auth-message";
import { HostMatch, type Participant } from "@/components/features/match/host-match";
import { VerifyDeck, type DeckOption } from "@/components/features/match/verify-deck";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { QrCode } from "@/components/features/qr-code";
import { createClient } from "@/lib/supabase/server";
import { getOrigin } from "@/lib/origin";
import { cancelMatch, updateMatchMeta } from "@/lib/services/matches";

export const metadata = { title: "Live match" };

export default async function HostMatchPage({
  params,
  searchParams,
}: {
  params: { matchId: string };
  searchParams: { error?: string; message?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS (matches_select) returns the row only to group members; else null -> 404.
  const { data: match } = await supabase
    .from("matches")
    .select("id, group_id, host_id, status, notes, tags")
    .eq("id", params.matchId)
    .maybeSingle();

  if (!match) notFound();

  // Host-only screen; non-hosts go to the join page.
  if (match.host_id !== user.id) {
    redirect(`/match/${match.id}/join`);
  }

  // If already finalized, send the host back to the pod.
  if (match.status !== "open") {
    redirect(`/groups/${match.group_id}`);
  }

  // Host's own decks (for self-verify) + current verification snapshot.
  const { data: decks } = await supabase
    .from("decks")
    .select("id, name, commander_name")
    .order("created_at", { ascending: false });
  const { data: mine } = await supabase
    .from("match_participants")
    .select("verified, deck_name_snapshot")
    .eq("match_id", match.id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Seed initial join status (kept live client-side).
  const { data: rows } = await supabase
    .from("match_participants")
    .select("user_id, verified, deck_name_snapshot")
    .eq("match_id", match.id)
    .order("joined_at", { ascending: true });

  const ids = (rows ?? []).map((r) => r.user_id);
  const { data: profs } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.display_name]));

  const initialParticipants: Participant[] = (rows ?? []).map((r) => ({
    userId: r.user_id,
    name: nameById.get(r.user_id) ?? "Player",
    verified: r.verified,
    deckName: r.deck_name_snapshot,
  }));

  const joinUrl = `${getOrigin()}/match/${match.id}/join`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Live match</h1>
        <Link href={`/groups/${match.group_id}`} className="text-sm text-muted-foreground underline">
          Back to pod
        </Link>
      </header>

      <AuthMessage error={searchParams.error} message={searchParams.message} />

      <Card>
        <CardHeader>
          <CardTitle>Your deck</CardTitle>
        </CardHeader>
        <CardContent>
          <VerifyDeck
            matchId={match.id}
            redirectTo={`/match/${match.id}/host`}
            decks={(decks ?? []) as DeckOption[]}
            currentDeckName={mine?.verified ? (mine.deck_name_snapshot ?? null) : null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite to the table</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <QrCode value={joinUrl} label="Scan to join this match" size={180} />
          <p className="text-center text-sm text-muted-foreground">
            Pod members scan to join this match and verify their deck.
          </p>
        </CardContent>
      </Card>

      <HostMatch matchId={match.id} initialParticipants={initialParticipants} />

      {/* Game notes — host-only by RLS (matches_update_open); freeze at finalize. */}
      <Card>
        <CardHeader>
          <CardTitle>Game notes</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateMatchMeta} className="flex flex-col gap-3">
            <input type="hidden" name="matchId" value={match.id} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={500}
                defaultValue={match.notes ?? ""}
                placeholder="The Gitrog combo went off on turn 6…"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tags">Tags</Label>
              <input
                id="tags"
                name="tags"
                type="text"
                defaultValue={(match.tags ?? []).join(", ")}
                placeholder="combo, close-game (comma-separated, up to 5)"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" variant="outline">
              Save notes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Close without recording — frees the pod to start a new match. */}
      <form action={cancelMatch}>
        <input type="hidden" name="matchId" value={match.id} />
        <input type="hidden" name="redirectTo" value={`/groups/${match.group_id}`} />
        <Button type="submit" variant="ghost" size="sm" className="self-start text-destructive">
          Close match without recording
        </Button>
      </form>
    </main>
  );
}
