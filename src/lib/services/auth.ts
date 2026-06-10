"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/lib/validators/auth";

/**
 * Auth Server Actions (email + password). Each validates with Zod at the
 * boundary, then delegates to Supabase Auth. On failure we redirect back with a
 * user-safe `?error=` message; on success we redirect into the app. RLS — not
 * these actions — is the real access boundary for data.
 */

function encodeError(message: string): string {
  return encodeURIComponent(message);
}

export async function signUp(formData: FormData): Promise<void> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/sign-up?error=${encodeError(msg)}`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });

  if (error) {
    redirect(`/sign-up?error=${encodeError(error.message)}`);
  }

  // With email confirmation enabled, no session is returned yet.
  if (!data.session) {
    redirect(`/sign-in?message=${encodeError("Check your email to confirm your account.")}`);
  }

  revalidatePath("/", "layout");
  redirect("/groups");
}

export async function signIn(formData: FormData): Promise<void> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/sign-in?error=${encodeError(msg)}`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirect(`/sign-in?error=${encodeError("Invalid email or password.")}`);
  }

  revalidatePath("/", "layout");
  redirect("/groups");
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
