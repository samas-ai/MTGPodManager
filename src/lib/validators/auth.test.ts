import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "./auth";

describe("signUpSchema", () => {
  it("accepts a valid sign-up", () => {
    const r = signUpSchema.safeParse({
      email: "a@b.com",
      password: "supersecret",
      displayName: "Tana",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a short password", () => {
    const r = signUpSchema.safeParse({ email: "a@b.com", password: "short", displayName: "Tana" });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const r = signUpSchema.safeParse({ email: "nope", password: "supersecret", displayName: "Tana" });
    expect(r.success).toBe(false);
  });

  it("rejects a display name over 40 chars", () => {
    const r = signUpSchema.safeParse({
      email: "a@b.com",
      password: "supersecret",
      displayName: "x".repeat(41),
    });
    expect(r.success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("requires a non-empty password", () => {
    const r = signInSchema.safeParse({ email: "a@b.com", password: "" });
    expect(r.success).toBe(false);
  });
});
