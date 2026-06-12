import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { winPercent, type RecentMatch, type Standing } from "@/lib/stats";

/**
 * Seasons-as-"Sets" reads. A season is a date window; a finalized match belongs
 * to it when its finalized_at is in [startedAt, endedAt). Season-scoped stats
 * are the same fold as the all-time helpers, filtered by that range — no schema
 * change to matches, no second source of truth. Helpers take an RLS-scoped
 * server client (seasons_select / matches RLS scope rows to members).
 */
type DB = SupabaseClient<Database>;

export interface Season {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string | null;
  symbolSeed: number;
  isActive: boolean;
}

export async function getSeasons(supabase: DB, groupId: string): Promise<Season[]> {
  const { data } = await supabase
    .from("seasons")
    .select("id, name, started_at, ended_at, symbol_seed")
    .eq("group_id", groupId)
    .order("started_at", { ascending: false });

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    symbolSeed: s.symbol_seed,
    isActive: s.ended_at === null,
  }));
}

async function namesByIds(supabase: DB, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.display_name]));
}

/**
 * Standings for finalized matches within a season's date range. Same shape as
 * the all-time getStandings, computed on read from matches + participants.
 */
export async function getSeasonStandings(
  supabase: DB,
  groupId: string,
  season: Pick<Season, "startedAt" | "endedAt">,
): Promise<Standing[]> {
  let query = supabase
    .from("matches")
    .select("id, winner_user_id")
    .eq("group_id", groupId)
    .eq("status", "finalized")
    .gte("finalized_at", season.startedAt);
  if (season.endedAt) query = query.lt("finalized_at", season.endedAt);

  const { data: matches } = await query;
  const matchRows = matches ?? [];
  if (matchRows.length === 0) return [];

  const { data: parts } = await supabase
    .from("match_participants")
    .select("match_id, user_id")
    .in(
      "match_id",
      matchRows.map((m) => m.id),
    );

  const winnerByMatch = new Map(matchRows.map((m) => [m.id, m.winner_user_id]));
  const tally = new Map<string, { games: number; wins: number }>();
  for (const p of parts ?? []) {
    const t = tally.get(p.user_id) ?? { games: 0, wins: 0 };
    t.games += 1;
    if (winnerByMatch.get(p.match_id) === p.user_id) t.wins += 1;
    tally.set(p.user_id, t);
  }

  const names = await namesByIds(supabase, [...tally.keys()]);
  return [...tally.entries()]
    .map(([userId, t]) => ({
      userId,
      name: names.get(userId) ?? "Player",
      games: t.games,
      wins: t.wins,
      pct: winPercent(t.wins, t.games),
    }))
    .sort((a, b) => b.pct - a.pct || b.games - a.games || a.name.localeCompare(b.name));
}

/** Finalized matches within a season's range, newest first (the Chronicle). */
export async function getSeasonRecentMatches(
  supabase: DB,
  groupId: string,
  season: Pick<Season, "startedAt" | "endedAt">,
  limit: number,
): Promise<RecentMatch[]> {
  let query = supabase
    .from("matches")
    .select("id, winner_user_id, finalized_at, notes, tags")
    .eq("group_id", groupId)
    .eq("status", "finalized")
    .gte("finalized_at", season.startedAt)
    .order("finalized_at", { ascending: false })
    .limit(limit);
  if (season.endedAt) query = query.lt("finalized_at", season.endedAt);

  const { data } = await query;
  const rows = data ?? [];
  const names = await namesByIds(
    supabase,
    rows.map((r) => r.winner_user_id).filter((v): v is string => v !== null),
  );

  return rows.map((r) => ({
    id: r.id,
    winnerName: r.winner_user_id ? (names.get(r.winner_user_id) ?? "Player") : null,
    finalizedAt: r.finalized_at,
    notes: r.notes,
    tags: r.tags ?? [],
  }));
}
