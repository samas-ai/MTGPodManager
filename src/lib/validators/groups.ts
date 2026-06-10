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

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type JoinGroupInput = z.infer<typeof joinGroupSchema>;
