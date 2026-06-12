import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthMessage } from "@/components/features/auth/auth-message";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { VerifyDeck, type DeckOption } from "@/components/features/match/verify-deck";
import { CommanderArt } from "@/components/features/commander-art";
import { ColorPips, colorIdentityLabel } from "@/components/features/color-pips";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Join match" };

export default async function JoinMatchPage({
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

  // The host verifies on their own screen.
  if (match.host_id === user.id) redirect(`/match/${match.id}/host`);

  const closed = match.status !== "open";

  const { data: decks } = await supabase
    .from("decks")
    .select("id, name, commander_name")
    .order("created_at", { ascending: false });

  // Has the caller already verified? (RLS lets members read participants.)
  const { data: mine } = await supabase
    .from("match_participants")
    .select(
      "verified, deck_name_snapshot, commander_snapshot, art_crop_snapshot, card_image_snapshot, artist_snapshot, color_identity_snapshot",
    )
    .eq("match_id", match.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <PageHeader title="Join match" back={{ href: `/groups/${match.group_id}`, label: "Back to pod" }} />

      <AuthMessage error={searchParams.error} message={searchParams.message} />

      <Card>
        <CardHeader>
          <CardTitle>{closed ? "Match closed" : "Confirm your deck"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {closed ? (
            <p className="text-sm text-muted-foreground">
              This match is no longer open for joining.
            </p>
          ) : (
            <>
              <VerifyDeck
                matchId={match.id}
                redirectTo={`/match/${match.id}/join`}
                decks={(decks ?? []) as DeckOption[]}
                currentDeckName={mine?.verified ? (mine.deck_name_snapshot ?? null) : null}
              />
              {mine?.verified ? (
                <div className="space-y-2">
                  <CommanderArt
                    cardImage={mine.card_image_snapshot}
                    artCrop={mine.art_crop_snapshot}
                    artist={mine.artist_snapshot}
                    alt={`${mine.commander_snapshot ?? "Commander"} art`}
                    priority
                  />
                  {mine.color_identity_snapshot && mine.color_identity_snapshot.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <ColorPips identity={mine.color_identity_snapshot} />
                      {colorIdentityLabel(mine.color_identity_snapshot) ? (
                        <span className="text-xs text-muted-foreground">
                          {colorIdentityLabel(mine.color_identity_snapshot)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="success">verified</Badge>
                    Waiting for the host to record the result.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
