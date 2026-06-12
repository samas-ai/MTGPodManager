"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { groupIdSchema } from "@/lib/validators/groups";

/**
 * Season Server Actions. start_season is the only write path (SECURITY DEFINER,
 * admin-checked in the RPC); we keep app-side validation light and map the RPC's
 * exceptions to friendly copy.
 */
function enc(message: string): string {
  return encodeURIComponent(message);
}

export async function startSeason(formData: FormData): Promise<void> {
  const groupId = groupIdSchema.safeParse(formData.get("groupId"));
  if (!groupId.success) {
    redirect(`/groups?error=${enc("Invalid pod.")}`);
  }
  const back = `/stats/${groupId.data}`;

  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
  if (name.length < 1 || name.length > 60) {
    redirect(`${back}?error=${enc("Season name must be 1–60 characters.")}`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase.rpc("start_season", {
    p_group_id: groupId.data,
    p_name: name,
  });

  if (error) {
    console.error("[seasons] start_season failed", error.message);
    const msg = error.message.includes("not_an_admin")
      ? "Only a pod admin can start a season."
      : error.message.includes("invalid_season_name")
        ? "Season name must be 1–60 characters."
        : "Couldn't start the season. Please try again.";
    redirect(`${back}?error=${enc(msg)}`);
  }

  revalidatePath(back);
  redirect(`${back}?message=${enc("New season started.")}`);
}
