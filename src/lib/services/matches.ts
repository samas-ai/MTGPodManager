"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { groupIdSchema } from "@/lib/validators/groups";
import { finalizeMatchSchema, verifyParticipationSchema } from "@/lib/validators/matches";
import { safePath } from "@/lib/safe-path";

/**
 * Match Server Actions.
 *  - startMatch: host opens a match (RLS matches_insert_host).
 *  - verifyParticipation: a member picks a registered deck and verifies (own row,
 *    match open, via mp_insert_self/mp_update_self), snapshotting deck identity.
 *  - finalizeMatch: host records the winner via the finalize_match() RPC — the
 *    only path that can set status='finalized'.
 */

function enc(message: string): string {
  return encodeURIComponent(message);
}

function friendlyFinalizeError(rpcError: string): string {
  if (rpcError.includes("unverified_participants_present"))
    return "Everyone must pick a deck and verify first.";
  if (rpcError.includes("need_at_least_two_participants"))
    return "You need at least 2 verified players.";
  if (rpcError.includes("winner_must_be_participant"))
    return "The winner must be one of the players.";
  if (rpcError.includes("only_host_can_finalize")) return "Only the host can finalize.";
  if (rpcError.includes("match_not_open")) return "This match is already finalized.";
  return "Couldn't finalize the match. Please try again.";
}

export async function startMatch(formData: FormData): Promise<void> {
  const groupId = groupIdSchema.safeParse(formData.get("groupId"));
  if (!groupId.success) {
    redirect(`/groups?error=${enc("Invalid group.")}`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data, error } = await supabase
    .from("matches")
    .insert({ group_id: groupId.data, host_id: user.id, status: "open" })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[matches] startMatch failed", error);
    redirect(`/groups/${groupId.data}?error=${enc("Couldn't start the match. Please try again.")}`);
  }

  redirect(`/match/${data.id}/host`);
}

export async function verifyParticipation(formData: FormData): Promise<void> {
  const redirectTo = safePath(formData.get("redirectTo"), "/groups");
  const parsed = verifyParticipationSchema.safeParse({
    matchId: formData.get("matchId"),
    deckId: formData.get("deckId"),
  });
  if (!parsed.success) {
    redirect(`${redirectTo}?error=${enc(parsed.error.issues[0]?.message ?? "Pick a deck.")}`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Load the deck under owner-only RLS — proves the deck belongs to the caller.
  const { data: deck } = await supabase
    .from("decks")
    .select("id, name, commander_name")
    .eq("id", parsed.data.deckId)
    .maybeSingle();

  if (!deck) {
    redirect(`${redirectTo}?error=${enc("That deck isn't available.")}`);
  }

  // Snapshot deck identity so history stays correct if the deck is later changed.
  const { error } = await supabase.from("match_participants").upsert(
    {
      match_id: parsed.data.matchId,
      user_id: user.id,
      deck_id: deck.id,
      deck_name_snapshot: deck.name,
      commander_snapshot: deck.commander_name,
      verified: true,
    },
    { onConflict: "match_id,user_id" },
  );

  if (error) {
    console.error("[matches] verifyParticipation failed", error);
    redirect(`${redirectTo}?error=${enc("Couldn't verify — the match may be closed.")}`);
  }

  revalidatePath(`/match/${parsed.data.matchId}/host`);
  revalidatePath(`/match/${parsed.data.matchId}/join`);
  redirect(`${redirectTo}?message=${enc("You're verified.")}`);
}

export async function finalizeMatch(formData: FormData): Promise<void> {
  const parsed = finalizeMatchSchema.safeParse({
    matchId: formData.get("matchId"),
    winnerId: formData.get("winnerId"),
  });
  if (!parsed.success) {
    const back = safePath(formData.get("redirectTo"), "/groups");
    redirect(`${back}?error=${enc(parsed.error.issues[0]?.message ?? "Pick a winner.")}`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Resolve the group for the post-finalize redirect (RLS member-scoped).
  const { data: match } = await supabase
    .from("matches")
    .select("group_id")
    .eq("id", parsed.data.matchId)
    .maybeSingle();
  const hostPath = `/match/${parsed.data.matchId}/host`;

  const { error } = await supabase.rpc("finalize_match", {
    p_match_id: parsed.data.matchId,
    p_winner: parsed.data.winnerId,
  });

  if (error) {
    console.error("[matches] finalize failed", error.message);
    redirect(`${hostPath}?error=${enc(friendlyFinalizeError(error.message))}`);
  }

  const groupPath = match ? `/groups/${match.group_id}` : "/groups";
  revalidatePath(groupPath);
  redirect(`${groupPath}?message=${enc("Match recorded.")}`);
}
