import { z } from "zod";

// Mirrors the groups.name CHECK constraint (1–60 chars).
export const createGroupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Group name is required.")
    .max(60, "Group name must be 60 characters or fewer."),
});

// Invite codes are 8 uppercase alphanumerics (see create_invite RPC). We accept
// any case/whitespace here and normalize; the RPC upper-trims as the backstop.
export const joinGroupSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter an invite code.")
    .transform((c) => c.toUpperCase()),
});

export const groupIdSchema = z.string().uuid("Invalid group id.");

// Group management (B5). The RPCs re-validate + enforce authorization; these
// just shape the boundary.
export const renameGroupSchema = z.object({
  groupId: z.string().uuid("Invalid group."),
  name: z
    .string()
    .trim()
    .min(1, "Pod name is required.")
    .max(60, "Pod name must be 60 characters or fewer."),
});

export const memberActionSchema = z.object({
  groupId: z.string().uuid("Invalid group."),
  userId: z.string().uuid("Invalid member."),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
