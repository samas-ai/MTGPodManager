import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Group stats reads (F6). Helpers take an RLS-scoped server client so the
 * security_invoker views are automatically group-scoped. `winPercent` is pure
 * and unit-tested; we compute it in JS from wins/games to avoid numeric-format
 * ambiguity from the view's `win_rate` column.
 */
type DB = SupabaseClient<Database>;

export function winPercent(wins: number, games: number): number {
  return games > 0 ? Math.round((wins / games) * 100) : 0;
}

export interface Standing {
  userId: string;
  name: string;
  games: number;
  wins: number;
  pct: number;
}

export interface DeckPlayCount {
  name: string;
  commander: string | null;
  timesPlayed: number;
}

export interface RecentMatch {
  id: string;
  winnerName: string | null;
  finalizedAt: string | null;
}

export interface MatchEvent {
  winnerId: string | null;
  participantIds: string[];
}

export interface PlayerTrend {
  userId: string;
  name: string;
  games: number;
  pct: number;
  /** Cumulative win % after each of this player's games, in match order. */
  series: number[];
}

/**
 * Folds chronologically-ordered finalized matches into a cumulative win-rate
 * series per player. Pure — unit-tested. A player gets one point per game
 * they participated in.
 */
export function winRateSeries(events: MatchEvent[]): Map<string, number[]> {
  const tally = new Map<string, { wins: number; games: number; series: number[] }>();
  for (const event of events) {
    for (const id of event.participantIds) {
      const t = tally.get(id) ?? { wins: 0, games: 0, series: [] };
      t.games += 1;
      if (event.winnerId === id) t.wins += 1;
      t.series.push(winPercent(t.wins, t.games));
      tally.set(id, t);
    }
  }
  return new Map([...tally.entries()].map(([id, t]) => [id, t.series]));
}

export async function getStandingsOverTime(supabase: DB, groupId: string): Promise<PlayerTrend[]> {
  const { data: matches } = await supabase
    .from("matches")
    .select("id, winner_user_id")
    .eq("group_id", groupId)
    .eq("status", "finalized")
    .order("finalized_at", { ascending: true });

  const matchRows = matches ?? [];
  if (matchRows.length === 0) return [];

  const { data: parts } = await supabase
    .from("match_participants")
    .select("match_id, user_id")
    .in(
      "match_id",
      matchRows.map((m) => m.id),
    );

  const byMatch = new Map<string, string[]>();
  for (const p of parts ?? []) {
    const list = byMatch.get(p.match_id) ?? [];
    list.push(p.user_id);
    byMatch.set(p.match_id, list);
  }

  const series = winRateSeries(
    matchRows.map((m) => ({
      winnerId: m.winner_user_id,
      participantIds: byMatch.get(m.id) ?? [],
    })),
  );

  const names = await namesByIds(supabase, [...series.keys()]);

  return [...series.entries()]
    .map(([userId, s]) => ({
      userId,
      name: names.get(userId) ?? "Player",
      games: s.length,
      pct: s[s.length - 1] ?? 0,
      series: s,
    }))
    .sort((a, b) => b.pct - a.pct || b.games - a.games || a.name.localeCompare(b.name));
}

export interface DeckWinrate {
  name: string;
  commander: string | null;
  games: number;
  wins: number;
  pct: number;
}

export interface HeadToHeadRow {
  playerId: string;
  playerName: string;
  opponentId: string;
  opponentName: string;
  gamesTogether: number;
  playerWins: number;
  opponentWins: number;
}

async function namesByIds(supabase: DB, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.display_name]));
}

export async function getStandings(supabase: DB, groupId: string): Promise<Standing[]> {
  const { data } = await supabase
    .from("group_player_winrates")
    .select("user_id, games, wins")
    .eq("group_id", groupId);

  const rows = (data ?? []).filter(
    (r): r is { user_id: string; games: number; wins: number } =>
      r.user_id !== null && (r.games ?? 0) > 0,
  );
  const names = await namesByIds(
    supabase,
    rows.map((r) => r.user_id),
  );

  return rows
    .map((r) => ({
      userId: r.user_id,
      name: names.get(r.user_id) ?? "Player",
      games: r.games,
      wins: r.wins ?? 0,
      pct: winPercent(r.wins ?? 0, r.games),
    }))
    .sort((a, b) => b.pct - a.pct || b.games - a.games || a.name.localeCompare(b.name));
}

export async function getDeckPlayCounts(supabase: DB, groupId: string): Promise<DeckPlayCount[]> {
  const { data } = await supabase
    .from("group_deck_play_counts")
    .select("deck_name_snapshot, commander_snapshot, times_played")
    .eq("group_id", groupId);

  return (data ?? [])
    .filter((r) => r.deck_name_snapshot !== null)
    .map((r) => ({
      name: r.deck_name_snapshot as string,
      commander: r.commander_snapshot,
      timesPlayed: r.times_played ?? 0,
    }))
    .sort((a, b) => b.timesPlayed - a.timesPlayed);
}

export async function getDeckWinrates(supabase: DB, groupId: string): Promise<DeckWinrate[]> {
  const { data } = await supabase
    .from("group_deck_winrates")
    .select("deck_name_snapshot, commander_snapshot, games, wins")
    .eq("group_id", groupId);

  return (data ?? [])
    .filter((r) => r.deck_name_snapshot !== null && (r.games ?? 0) > 0)
    .map((r) => ({
      name: r.deck_name_snapshot as string,
      commander: r.commander_snapshot,
      games: r.games ?? 0,
      wins: r.wins ?? 0,
      pct: winPercent(r.wins ?? 0, r.games ?? 0),
    }))
    .sort((a, b) => b.pct - a.pct || b.games - a.games || a.name.localeCompare(b.name));
}

/**
 * Head-to-head pairs for a group. The view emits both directions; we keep the
 * canonical direction (playerId < opponentId) so each pair renders once.
 */
export async function getHeadToHead(supabase: DB, groupId: string): Promise<HeadToHeadRow[]> {
  const { data } = await supabase
    .from("group_head_to_head")
    .select("player_id, opponent_id, games_together, player_wins, opponent_wins")
    .eq("group_id", groupId);

  const rows = (data ?? []).filter(
    (r): r is {
      player_id: string;
      opponent_id: string;
      games_together: number | null;
      player_wins: number | null;
      opponent_wins: number | null;
    } => r.player_id !== null && r.opponent_id !== null && r.player_id < r.opponent_id,
  );

  const names = await namesByIds(supabase, [
    ...rows.map((r) => r.player_id),
    ...rows.map((r) => r.opponent_id),
  ]);

  return rows
    .map((r) => ({
      playerId: r.player_id,
      playerName: names.get(r.player_id) ?? "Player",
      opponentId: r.opponent_id,
      opponentName: names.get(r.opponent_id) ?? "Player",
      gamesTogether: r.games_together ?? 0,
      playerWins: r.player_wins ?? 0,
      opponentWins: r.opponent_wins ?? 0,
    }))
    .sort(
      (a, b) =>
        b.gamesTogether - a.gamesTogether || a.playerName.localeCompare(b.playerName),
    );
}

export async function getRecentMatches(
  supabase: DB,
  groupId: string,
  limit: number,
): Promise<RecentMatch[]> {
  const { data } = await supabase
    .from("matches")
    .select("id, winner_user_id, finalized_at")
    .eq("group_id", groupId)
    .eq("status", "finalized")
    .order("finalized_at", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  const names = await namesByIds(
    supabase,
    rows.map((r) => r.winner_user_id).filter((v): v is string => v !== null),
  );

  return rows.map((r) => ({
    id: r.id,
    winnerName: r.winner_user_id ? (names.get(r.winner_user_id) ?? "Player") : null,
    finalizedAt: r.finalized_at,
  }));
}
