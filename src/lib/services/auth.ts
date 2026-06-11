"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/lib/validators/auth";
import { safePath } from "@/lib/safe-path";

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

  // Where to land after auth — only safe, same-origin relative paths.
  const next = safePath(formData.get("next"), "/groups");

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/sign-up?error=${encodeError(msg)}&next=${encodeError(next)}`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });

  if (error) {
    redirect(`/sign-up?error=${encodeError(error.message)}&next=${encodeError(next)}`);
  }

  // With email confirmation enabled, no session is returned yet — carry `next`
  // to sign-in so the post-confirmation sign-in still lands in the right place.
  if (!data.session) {
    redirect(
      `/sign-in?message=${encodeError("Check your email to confirm your account.")}&next=${encodeError(next)}`,
    );
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signIn(formData: FormData): Promise<void> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  const next = safePath(formData.get("next"), "/groups");

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/sign-in?error=${encodeError(msg)}&next=${encodeError(next)}`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirect(`/sign-in?error=${encodeError("Invalid email or password.")}&next=${encodeError(next)}`);
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
