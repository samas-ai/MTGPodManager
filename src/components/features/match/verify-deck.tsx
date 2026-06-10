import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { verifyParticipation } from "@/lib/services/matches";

export interface DeckOption {
  id: string;
  name: string;
  commander_name: string;
}

/**
 * Reusable verify control (server-rendered form) used on both the join page and
 * the host screen. Picking a deck + submitting writes the caller's verified
 * participant row via the verifyParticipation Server Action. Owner-only RLS on
 * decks means the select only ever lists the caller's own decks.
 */
export function VerifyDeck({
  matchId,
  redirectTo,
  decks,
  currentDeckName,
}: {
  matchId: string;
  redirectTo: string;
  decks: DeckOption[];
  currentDeckName: string | null;
}) {
  if (decks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You have no decks yet.{" "}
        <Link href="/profile/decks" className="font-medium text-foreground underline">
          Add or import one
        </Link>{" "}
        to join.
      </p>
    );
  }

  return (
    <form action={verifyParticipation} className="flex flex-col gap-3">
      <input type="hidden" name="matchId" value={matchId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="deckId">{currentDeckName ? "Change your deck" : "Your deck"}</Label>
        <select
          id="deckId"
          name="deckId"
          required
          defaultValue=""
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="" disabled>
            Select a deck…
          </option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {d.commander_name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit">{currentDeckName ? "Update & verify" : "Confirm deck & verify"}</Button>
      {currentDeckName ? (
        <p className="text-xs text-muted-foreground">Verified with {currentDeckName}.</p>
      ) : null}
    </form>
  );
}
