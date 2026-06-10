import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthMessage } from "@/components/features/auth/auth-message";
import { HostMatch, type Participant } from "@/components/features/match/host-match";
import { VerifyDeck, type DeckOption } from "@/components/features/match/verify-deck";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, group_id, host_id, status")
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

      <HostMatch matchId={match.id} initialParticipants={initialParticipants} />
    </main>
  );
}
