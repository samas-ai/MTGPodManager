"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createDeckSchema, deckIdSchema } from "@/lib/validators/decks";
import { archidektUrlSchema } from "@/lib/validators/import";
import { importArchidektDeck } from "@/lib/services/import";
import { resolveCommanders } from "@/lib/services/scryfall";

/**
 * Deck registration Server Actions (F2, manual entry only). Decks are strictly
 * owner-private: the decks_all_own RLS policy enforces user_id = auth.uid() on
 * both read and write, so we never trust the client for ownership.
 */

function enc(message: string): string {
  return encodeURIComponent(message);
}

export async function createDeck(formData: FormData): Promise<void> {
  const parsed = createDeckSchema.safeParse({
    name: formData.get("name"),
    commanderName: formData.get("commanderName"),
  });
  if (!parsed.success) {
    redirect(`/profile/decks?error=${enc(parsed.error.issues[0]?.message ?? "Invalid input.")}`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Best-effort commander resolve (the PRD's "Scryfall-resolved commander" for
  // manual entry): enriches the deck with color identity + commander art when
  // Scryfall recognizes the name. Any failure (offline, typo, not found) is
  // swallowed and the deck still saves — the manual path stays a guarantee.
  let enrichment: {
    commander_scryfall_id?: string;
    color_identity?: string[];
    art_crop_url?: string | null;
    card_image_url?: string | null;
    artist?: string | null;
  } = {};
  const resolved = await resolveCommanders([parsed.data.commanderName]);
  if (resolved.ok && resolved.data[0]) {
    const c = resolved.data[0];
    enrichment = {
      commander_scryfall_id: c.scryfallId,
      color_identity: c.colorIdentity,
      art_crop_url: c.artCrop,
      card_image_url: c.cardImage,
      artist: c.artist,
    };
  }

  const { error } = await supabase.from("decks").insert({
    user_id: user.id,
    name: parsed.data.name,
    commander_name: parsed.data.commanderName,
    source: "manual",
    ...enrichment,
  });

  if (error) {
    console.error("[decks] create failed", error);
    redirect(`/profile/decks?error=${enc("Couldn't add that deck. Please try again.")}`);
  }

  revalidatePath("/profile/decks");
  redirect("/profile/decks");
}

export async function importDeck(formData: FormData): Promise<void> {
  const parsed = archidektUrlSchema.safeParse({ url: formData.get("url") });
  if (!parsed.success) {
    redirect(`/profile/decks?error=${enc(parsed.error.issues[0]?.message ?? "Invalid URL.")}`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Best-effort external import; on ANY failure we route the user to the manual
  // form below (the guarantee), never block deck registration.
  const result = await importArchidektDeck(parsed.data.deckId, parsed.data.url);
  if (!result.ok) {
    redirect(`/profile/decks?error=${enc(result.error)}`);
  }

  const { error } = await supabase.from("decks").insert({
    user_id: user.id,
    name: result.data.name,
    commander_name: result.data.commander_name,
    commander_scryfall_id: result.data.commander_scryfall_id,
    color_identity: result.data.color_identity,
    art_crop_url: result.data.art_crop_url,
    card_image_url: result.data.card_image_url,
    artist: result.data.artist,
    source: result.data.source,
    source_url: result.data.source_url,
    card_data: result.data.card_data,
  });

  if (error) {
    console.error("[decks] import insert failed", error);
    redirect(`/profile/decks?error=${enc("Imported the deck but couldn't save it. Try again.")}`);
  }

  revalidatePath("/profile/decks");
  redirect("/profile/decks");
}

export async function deleteDeck(formData: FormData): Promise<void> {
  const deckId = deckIdSchema.safeParse(formData.get("deckId"));
  if (!deckId.success) {
    redirect(`/profile/decks?error=${enc("Invalid deck.")}`);
  }

  const supabase = createClient();
  // RLS scopes the delete to the owner; a non-owner's delete simply affects 0 rows.
  const { error } = await supabase.from("decks").delete().eq("id", deckId.data);

  if (error) {
    console.error("[decks] delete failed", error);
    // 23503 = FK violation: a deck used in matches before migration 0006
    // (ON DELETE SET NULL) was applied. Give a clear, actionable message.
    const msg =
      error.code === "23503"
        ? "This deck is used in past matches. Apply migration 0006 to allow removing it."
        : "Couldn't remove that deck. Please try again.";
    redirect(`/profile/decks?error=${enc(msg)}`);
  }

  revalidatePath("/profile/decks");
  redirect("/profile/decks");
}
