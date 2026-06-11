import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { Sparkline } from "@/components/features/sparkline";
import {
  getDeckPlayCounts,
  getDeckWinrates,
  getHeadToHead,
  getRecentMatches,
  getStandings,
  getStandingsOverTime,
} from "@/lib/stats";

export const metadata = { title: "Stats" };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function StatsPage({ params }: { params: { groupId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // RLS returns the group only to members; else 404.
  const { data: group } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", params.groupId)
    .maybeSingle();
  if (!group) notFound();

  const [standings, decks, deckWinrates, headToHead, trends, recent] = await Promise.all([
    getStandings(supabase, group.id),
    getDeckPlayCounts(supabase, group.id),
    getDeckWinrates(supabase, group.id),
    getHeadToHead(supabase, group.id),
    getStandingsOverTime(supabase, group.id),
    getRecentMatches(supabase, group.id, 10),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6 pb-24">
      <PageHeader
        title={`${group.name} · Stats`}
        back={{ href: `/groups/${group.id}`, label: "Back to pod" }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent>
          {standings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No finalized matches yet.</p>
          ) : (
            <ol className="space-y-1">
              {standings.map((s, i) => (
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
          <CardTitle>Most-played decks</CardTitle>
        </CardHeader>
        <CardContent>
          {decks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decks played yet.</p>
          ) : (
            <ul className="space-y-1">
              {decks.map((d, i) => (
                <li key={`${d.name}-${i}`} className="flex items-center justify-between text-sm">
                  <span>
                    {d.name}
                    {d.commander ? (
                      <span className="text-muted-foreground"> · {d.commander}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-muted-foreground">×{d.timesPlayed}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Standings over time</CardTitle>
        </CardHeader>
        <CardContent>
          {trends.length === 0 ? (
            <p className="text-sm text-muted-foreground">No finalized matches yet.</p>
          ) : (
            <ul className="space-y-2">
              {trends.map((t) => (
                <li key={t.userId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{t.name}</span>
                  <span className="flex items-center gap-2">
                    <Sparkline
                      values={t.series}
                      label={`${t.name}'s win rate trend: ${t.pct}% after ${t.games} games`}
                    />
                    <span className="w-12 text-right tabular-nums text-muted-foreground">
                      {t.pct}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deck win rates</CardTitle>
        </CardHeader>
        <CardContent>
          {deckWinrates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No finalized matches yet.</p>
          ) : (
            <ul className="space-y-1">
              {deckWinrates.map((d, i) => (
                <li key={`${d.name}-${i}`} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    {d.name}
                    {d.commander ? (
                      <span className="text-muted-foreground"> · {d.commander}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {d.pct}% · {d.wins}/{d.games}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Head-to-head</CardTitle>
        </CardHeader>
        <CardContent>
          {headToHead.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Shared finalized matches will show up here.
            </p>
          ) : (
            <ul className="space-y-1">
              {headToHead.map((h) => (
                <li
                  key={`${h.playerId}-${h.opponentId}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">
                    {h.playerName} vs {h.opponentName}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {h.playerWins}–{h.opponentWins}
                    <span aria-hidden="true"> · </span>
                    <span aria-label={`${h.gamesTogether} games together`}>
                      {h.gamesTogether} games
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent matches</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No finalized matches yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((m) => (
                <li key={m.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span>{m.winnerName ? `${m.winnerName} won` : "Finalized"}</span>
                    <span className="text-muted-foreground">{formatDate(m.finalizedAt)}</span>
                  </div>
                  {(m.tags.length > 0 || m.notes) && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {m.tags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                      {m.notes && (
                        <span className="truncate text-xs text-muted-foreground">{m.notes}</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
