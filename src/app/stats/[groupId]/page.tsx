import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AuthMessage } from "@/components/features/auth/auth-message";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { Sparkline } from "@/components/features/sparkline";
import { StatBar } from "@/components/features/stat-bar";
import { SeasonSymbol } from "@/components/features/season-symbol";
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
import {
  getSeasons,
  getSeasonRecentMatches,
  getSeasonStandings,
  type Season,
} from "@/lib/seasons";
import { startSeason } from "@/lib/services/seasons";

export const metadata = { title: "Standings" };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams: { season?: string; error?: string; message?: string };
}) {
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

  const { data: membership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", group.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = membership?.role === "admin";

  const seasons = await getSeasons(supabase, group.id);
  const activeSeason = seasons.find((s) => s.isActive) ?? null;
  // Scope: ?season=all → all-time; ?season=<id> → that season; default → active
  // season if one exists, else all-time.
  const requested = searchParams.season;
  const selectedSeason: Season | null =
    requested === "all"
      ? null
      : requested
        ? (seasons.find((s) => s.id === requested) ?? activeSeason)
        : activeSeason;

  // Deck stats / head-to-head / trends stay all-time in this v1 (season-aware
  // deck stats can follow); standings + Chronicle reflect the selected scope.
  const [decks, deckWinrates, headToHead, trends] = await Promise.all([
    getDeckPlayCounts(supabase, group.id),
    getDeckWinrates(supabase, group.id),
    getHeadToHead(supabase, group.id),
    getStandingsOverTime(supabase, group.id),
  ]);

  const [standings, recent] = selectedSeason
    ? await Promise.all([
        getSeasonStandings(supabase, group.id, selectedSeason),
        getSeasonRecentMatches(supabase, group.id, selectedSeason, 10),
      ])
    : await Promise.all([
        getStandings(supabase, group.id),
        getRecentMatches(supabase, group.id, 10),
      ]);

  // Most-played bars are scaled to the busiest deck (1 floor avoids div-by-zero).
  const maxPlays = Math.max(1, ...decks.map((d) => d.timesPlayed));
  const scopeLabel = selectedSeason ? selectedSeason.name : "All-time";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6 pb-24 lg:max-w-5xl">
      <PageHeader
        title={`${group.name} · Standings`}
        subtitle="The running tale of your pod."
        back={{ href: `/groups/${group.id}`, label: "Back to pod" }}
      />

      <AuthMessage error={searchParams.error} message={searchParams.message} />

      {/* Seasons ("Sets"): scope selector + admin control. */}
      <Card>
        <CardHeader>
          <CardTitle>Seasons</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/stats/${group.id}?season=all`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                !selectedSeason
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              All-time
            </Link>
            {seasons.map((s) => (
              <Link
                key={s.id}
                href={`/stats/${group.id}?season=${s.id}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                  selectedSeason?.id === s.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <SeasonSymbol seed={s.symbolSeed} className="h-4 w-4" />
                <span>{s.name}</span>
                {s.isActive ? <Badge variant="success">active</Badge> : null}
              </Link>
            ))}
            {seasons.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                No seasons yet — start one to archive a stretch of games like a set.
              </span>
            ) : null}
          </div>
          {isAdmin ? (
            <form action={startSeason} className="flex items-end gap-2">
              <input type="hidden" name="groupId" value={group.id} />
              <div className="flex flex-1 flex-col gap-1.5">
                <label htmlFor="seasonName" className="text-sm font-medium">
                  Start a new season
                </label>
                <Input
                  id="seasonName"
                  name="name"
                  required
                  maxLength={60}
                  placeholder="Bloomburrow Nights"
                />
              </div>
              <Button type="submit" variant="outline">
                Start
              </Button>
            </form>
          ) : null}
          {selectedSeason ? (
            <p className="text-xs text-muted-foreground">
              {formatDate(selectedSeason.startedAt)} –{" "}
              {selectedSeason.endedAt ? formatDate(selectedSeason.endedAt) : "now"}. Standings and
              Chronicle below cover this season; deck stats are all-time.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {selectedSeason ? <SeasonSymbol seed={selectedSeason.symbolSeed} /> : null}
            <span>Standings · {scopeLabel}</span>
          </CardTitle>
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
