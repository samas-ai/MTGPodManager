import { z } from "zod";

// Validation at the action boundary. display_name mirrors the profiles CHECK
// constraint (1–40 chars); password floor is a usability minimum (Supabase
// enforces its own server-side policy too).
export const signUpSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required.")
    .max(40, "Display name must be 40 characters or fewer."),
});

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
