import { z } from "zod";

// Mirrors the profiles.display_name CHECK (1–40). Same rule as sign-up.
export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required.")
    .max(40, "Display name must be 40 characters or fewer."),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
