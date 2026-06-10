"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateProfileSchema } from "@/lib/validators/profile";

/**
 * Profile Server Action. The profiles_update_self RLS policy restricts updates
 * to the caller's own row, so the explicit eq("id", user.id) is belt-and-braces.
 */

function enc(message: string): string {
  return encodeURIComponent(message);
}

export async function updateDisplayName(formData: FormData): Promise<void> {
  const parsed = updateProfileSchema.safeParse({ displayName: formData.get("displayName") });
  if (!parsed.success) {
    redirect(`/profile?error=${enc(parsed.error.issues[0]?.message ?? "Invalid input.")}`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);

  if (error) {
    console.error("[profile] update display name failed", error);
    redirect(`/profile?error=${enc("Couldn't update your name. Please try again.")}`);
  }

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  redirect(`/profile?message=${enc("Display name updated.")}`);
}
