"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createGroupSchema, groupIdSchema, joinGroupSchema } from "@/lib/validators/groups";

/**
 * Group membership Server Actions. Every write goes through a SECURITY DEFINER
 * RPC — never a direct table write — because group_members has no insert policy.
 * Zod validates at the boundary; RLS + the RPCs are the authorization truth.
 */

function enc(message: string): string {
  return encodeURIComponent(message);
}

// Map raw RPC exception messages to user-safe copy.
function friendly(rpcError: string): string {
  switch (rpcError) {
    case "invalid_invite_code":
      return "That invite code isn't valid.";
    case "invite_expired":
      return "That invite has expired. Ask for a new one.";
    case "not_a_member":
      return "You're not a member of that group.";
    case "invalid_group_name":
      return "Group name must be 1–60 characters.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export async function createGroup(formData: FormData): Promise<void> {
  const parsed = createGroupSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    redirect(`/groups?error=${enc(parsed.error.issues[0]?.message ?? "Invalid input.")}`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_group", { p_name: parsed.data.name });

  if (error) {
    console.error("[groups] create_group failed", error);
    redirect(`/groups?error=${enc(friendly(error.message))}`);
  }

  revalidatePath("/groups");
  redirect(`/groups/${data}`);
}

export async function joinGroup(formData: FormData): Promise<void> {
  const parsed = joinGroupSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    redirect(`/groups?error=${enc(parsed.error.issues[0]?.message ?? "Invalid input.")}`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("accept_invite", { p_code: parsed.data.code });

  if (error) {
    console.error("[groups] accept_invite failed", error);
    redirect(`/groups?error=${enc(friendly(error.message))}`);
  }

  revalidatePath("/groups");
  redirect(`/groups/${data}`);
}

export async function createInvite(formData: FormData): Promise<void> {
  const groupId = groupIdSchema.safeParse(formData.get("groupId"));
  if (!groupId.success) {
    redirect(`/groups?error=${enc("Invalid group.")}`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_invite", { p_group_id: groupId.data });

  if (error) {
    console.error("[groups] create_invite failed", error);
    redirect(`/groups/${groupId.data}?error=${enc(friendly(error.message))}`);
  }

  revalidatePath(`/groups/${groupId.data}`);
  // Surface the generated code on the group page.
  redirect(`/groups/${groupId.data}?invite=${data}`);
}
