"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { adjustLife, initSeats, type Seat, type SeatCount } from "@/lib/match/life";
import { finalizeMatch } from "@/lib/services/matches";

export interface Participant {
  userId: string;
  name: string;
  verified: boolean;
  deckName: string | null;
}

type SupabaseBrowser = ReturnType<typeof createClient>;

// Postgres Changes (RLS-scoped) by default; flip to polling if free-tier
// Realtime limits bite. Both paths re-query the same RLS-scoped data.
const TRANSPORT = process.env.NEXT_PUBLIC_REALTIME_TRANSPORT === "polling" ? "polling" : "realtime";

async function fetchParticipants(
  supabase: SupabaseBrowser,
  matchId: string,
): Promise<Participant[]> {
  const { data: rows } = await supabase
    .from("match_participants")
    .select("user_id, verified, deck_name_snapshot")
    .eq("match_id", matchId)
    .order("joined_at", { ascending: true });

  if (!rows || rows.length === 0) return [];

  const ids = rows.map((r) => r.user_id);
  const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  const nameById = new Map((profs ?? []).map((p) => [p.id, p.display_name]));

  return rows.map((r) => ({
    userId: r.user_id,
    name: nameById.get(r.user_id) ?? "Player",
    verified: r.verified,
    deckName: r.deck_name_snapshot,
  }));
}

const SEAT_OPTIONS: SeatCount[] = [2, 3, 4];

export function HostMatch({
  matchId,
  initialParticipants,
}: {
  matchId: string;
  initialParticipants: Participant[];
}) {
  const [seatCount, setSeatCount] = useState<SeatCount>(4);
  const [seats, setSeats] = useState<Seat[]>(() => initSeats(4));
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);

  function setCount(count: SeatCount) {
    setSeatCount(count);
    setSeats(initSeats(count)); // resets life — intentional at the start of a game
  }

  const bump = useCallback((seatId: number, delta: number) => {
    setSeats((prev) => adjustLife(prev, seatId, delta));
  }, []);

  // Live join status: subscribe (Postgres Changes) or poll, then re-query.
  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const load = async () => {
      const list = await fetchParticipants(supabase, matchId);
      if (active) setParticipants(list);
    };

    void load();

    if (TRANSPORT === "polling") {
      const timer = setInterval(load, 3000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }

    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_participants", filter: `match_id=eq.${matchId}` },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [matchId]);

  const verified = participants.filter((p) => p.verified);
  const verifiedCount = verified.length;
  const canFinalize = verifiedCount >= 2;

  return (
    <div className="flex flex-col gap-6">
      {/* Seat count */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Players:</span>
        {SEAT_OPTIONS.map((n) => (
          <Button
            key={n}
            variant={n === seatCount ? "default" : "outline"}
            size="sm"
            onClick={() => setCount(n)}
          >
            {n}
          </Button>
        ))}
      </div>

      {/* Local life counter */}
      <div className="grid grid-cols-2 gap-3">
        {seats.map((seat) => (
          <Card key={seat.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Seat {seat.id}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2">
              <span
                className="text-4xl font-bold tabular-nums"
                aria-live="polite"
                aria-label={`Seat ${seat.id} life: ${seat.life}`}
              >
                {seat.life}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Seat ${seat.id} minus 5 life`}
                  onClick={() => bump(seat.id, -5)}
                >
                  −5
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Seat ${seat.id} minus 1 life`}
                  onClick={() => bump(seat.id, -1)}
                >
                  −1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Seat ${seat.id} plus 1 life`}
                  onClick={() => bump(seat.id, 1)}
                >
                  +1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Seat ${seat.id} plus 5 life`}
                  onClick={() => bump(seat.id, 5)}
                >
                  +5
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live join status */}
      <Card>
        <CardHeader>
          <CardTitle>
            Joined ({verifiedCount}/{participants.length} verified)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No players have joined yet. Share the pod so they can join and verify.
            </p>
          ) : (
            <ul className="space-y-1">
              {participants.map((p) => (
                <li key={p.userId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    {p.name}
                    {p.deckName ? ` · ${p.deckName}` : ""}
                  </span>
                  {p.verified ? (
                    <Badge variant="success">verified</Badge>
                  ) : (
                    <Badge>pending</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Finalize — host records the winner. Enforced by the finalize_match RPC. */}
      <Card>
        <CardHeader>
          <CardTitle>Record result</CardTitle>
        </CardHeader>
        <CardContent>
          {canFinalize ? (
            <form action={finalizeMatch} className="flex flex-col gap-3">
              <input type="hidden" name="matchId" value={matchId} />
              <input type="hidden" name="redirectTo" value={`/match/${matchId}/host`} />
              <div className="flex flex-col gap-2">
                <label htmlFor="winnerId" className="text-sm font-medium">
                  Winner
                </label>
                <select
                  id="winnerId"
                  name="winnerId"
                  required
                  defaultValue=""
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="" disabled>
                    Select the winner…
                  </option>
                  {verified.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit">Finalize match</Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              At least 2 players must pick a deck and verify before you can record a winner.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
