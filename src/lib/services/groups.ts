"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createGroupSchema,
  groupIdSchema,
  joinGroupSchema,
  memberActionSchema,
  renameGroupSchema,
} from "@/lib/validators/groups";

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
      return "Pod name must be 1–60 characters.";
    case "not_an_admin":
      return "Only a pod admin can do that.";
    case "last_admin_cannot_leave":
      return "You're the only admin — promote someone else before leaving.";
    case "use_leave_to_remove_self":
      return "Use “Leave pod” to remove yourself.";
    case "cannot_remove_last_admin":
      return "You can't remove the last admin.";
    case "cannot_demote_last_admin":
      return "Promote another admin before stepping down.";
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

// ---- Group management (B5) — each wraps a SECURITY DEFINER RPC ---------------

export async function renameGroup(formData: FormData): Promise<void> {
  const parsed = renameGroupSchema.safeParse({
    groupId: formData.get("groupId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    redirect(`/groups?error=${enc(parsed.error.issues[0]?.message ?? "Invalid input.")}`);
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("rename_group", {
    p_group_id: parsed.data.groupId,
    p_name: parsed.data.name,
  });

  const back = `/groups/${parsed.data.groupId}`;
  if (error) {
    console.error("[groups] rename_group failed", error.message);
    redirect(`${back}?error=${enc(friendly(error.message))}`);
  }
  revalidatePath(back);
  redirect(`${back}?message=${enc("Pod renamed.")}`);
}

export async function leaveGroup(formData: FormData): Promise<void> {
  const groupId = groupIdSchema.safeParse(formData.get("groupId"));
  if (!groupId.success) {
    redirect(`/groups?error=${enc("Invalid group.")}`);
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("leave_group", { p_group_id: groupId.data });

  if (error) {
    console.error("[groups] leave_group failed", error.message);
    redirect(`/groups/${groupId.data}?error=${enc(friendly(error.message))}`);
  }
  revalidatePath("/groups");
  redirect(`/groups?message=${enc("You left the pod.")}`);
}

export async function removeMember(formData: FormData): Promise<void> {
  const parsed = memberActionSchema.safeParse({
    groupId: formData.get("groupId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) {
    redirect(`/groups?error=${enc("Invalid request.")}`);
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("remove_member", {
    p_group_id: parsed.data.groupId,
    p_user_id: parsed.data.userId,
  });

  const back = `/groups/${parsed.data.groupId}`;
  if (error) {
    console.error("[groups] remove_member failed", error.message);
    redirect(`${back}?error=${enc(friendly(error.message))}`);
  }
  revalidatePath(back);
  redirect(`${back}?message=${enc("Member removed.")}`);
}

export async function setAdmin(formData: FormData): Promise<void> {
  const parsed = memberActionSchema.safeParse({
    groupId: formData.get("groupId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) {
    redirect(`/groups?error=${enc("Invalid request.")}`);
  }
  const makeAdmin = formData.get("makeAdmin") === "true";

  const supabase = createClient();
  const { error } = await supabase.rpc("set_admin", {
    p_group_id: parsed.data.groupId,
    p_user_id: parsed.data.userId,
    p_make_admin: makeAdmin,
  });

  const back = `/groups/${parsed.data.groupId}`;
  if (error) {
    console.error("[groups] set_admin failed", error.message);
    redirect(`${back}?error=${enc(friendly(error.message))}`);
  }
  revalidatePath(back);
  redirect(`${back}?message=${enc(makeAdmin ? "Promoted to admin." : "Admin removed.")}`);
}

export async function revokeInvites(formData: FormData): Promise<void> {
  const groupId = groupIdSchema.safeParse(formData.get("groupId"));
  if (!groupId.success) {
    redirect(`/groups?error=${enc("Invalid group.")}`);
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("revoke_invites", { p_group_id: groupId.data });

  const back = `/groups/${groupId.data}`;
  if (error) {
    console.error("[groups] revoke_invites failed", error.message);
    redirect(`${back}?error=${enc(friendly(error.message))}`);
  }
  revalidatePath(back);
  redirect(`${back}?message=${enc("Invite codes revoked.")}`);
}
