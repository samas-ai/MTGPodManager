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
