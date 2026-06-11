import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { Sparkline } from "@/components/features/sparkline";
import { StatBar } from "@/components/features/stat-bar";
import {
  ColorPips,
  ColorIdentityEdge,
  colorIdentityLabel,
} from "@/components/features/color-pips";
import {
  getDeckPlayCounts,
  getDeckWinrates,
  getHeadToHead,
  getRecentMatches,
  getStandings,
  getStandingsOverTime,
} from "@/lib/stats";

export const metadata = { title: "Standings" };

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

  // Most-played bars are scaled to the busiest deck (1 floor avoids div-by-zero).
  const maxPlays = Math.max(1, ...decks.map((d) => d.timesPlayed));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6 pb-24 lg:max-w-5xl">
      <PageHeader
        title={`${group.name} · Standings`}
        subtitle="The running tale of your pod."
        back={{ href: `/groups/${group.id}`, label: "Back to pod" }}
      />

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent>
          {standings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No games chronicled yet.</p>
          ) : (
            <ol className="space-y-2">
              {standings.map((s, i) => (
                <li
                  key={s.userId}
                  className={cn(
                    "flex flex-col gap-1 rounded-md text-sm",
                    i === 0 && "mtg-foil border-l-2 border-accent py-1 pl-2 font-medium",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      {i + 1}. {s.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.pct}% · {s.wins}/{s.games}
                    </span>
                  </div>
                  <StatBar value={s.pct} max={100} tone={i === 0 ? "accent" : "primary"} />
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
            <p className="text-sm text-muted-foreground">No decks sleeved up yet.</p>
          ) : (
            <ul className="space-y-2">
              {decks.map((d, i) => (
                <li
                  key={`${d.name}-${i}`}
                  className="relative flex flex-col gap-1 overflow-hidden rounded-md py-1 pl-3 text-sm"
                >
                  <ColorIdentityEdge identity={d.colorIdentity} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <ColorPips identity={d.colorIdentity} />
                        <span className="truncate">
                          {d.name}
                          {d.commander ? (
                            <span className="text-muted-foreground"> · {d.commander}</span>
                          ) : null}
                        </span>
                      </span>
                      {colorIdentityLabel(d.colorIdentity) ? (
                        <span className="block text-xs text-muted-foreground">
                          {colorIdentityLabel(d.colorIdentity)}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      ×{d.timesPlayed}
                    </span>
                  </div>
                  <StatBar value={d.timesPlayed} max={maxPlays} />
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
            <p className="text-sm text-muted-foreground">No games chronicled yet.</p>
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
            <p className="text-sm text-muted-foreground">No games chronicled yet.</p>
          ) : (
            <ul className="space-y-2">
              {deckWinrates.map((d, i) => (
                <li
                  key={`${d.name}-${i}`}
                  className="relative flex flex-col gap-1 overflow-hidden rounded-md py-1 pl-3 text-sm"
                >
                  <ColorIdentityEdge identity={d.colorIdentity} />
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <ColorPips identity={d.colorIdentity} />
                        <span className="truncate">
                          {d.name}
                          {d.commander ? (
                            <span className="text-muted-foreground"> · {d.commander}</span>
                          ) : null}
                        </span>
                      </span>
                      {colorIdentityLabel(d.colorIdentity) ? (
                        <span className="block text-xs text-muted-foreground">
                          {colorIdentityLabel(d.colorIdentity)}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {d.pct}% · {d.wins}/{d.games}
                    </span>
                  </div>
                  <StatBar value={d.pct} max={100} />
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
          <CardTitle>Chronicle</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No games chronicled yet.</p>
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
      </div>
    </main>
  );
}
