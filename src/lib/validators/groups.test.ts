import { describe, expect, it } from "vitest";
import { createGroupSchema, groupIdSchema, joinGroupSchema } from "./groups";

describe("createGroupSchema", () => {
  it("accepts a valid name and trims it", () => {
    const r = createGroupSchema.safeParse({ name: "  Tuesday EDH  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Tuesday EDH");
  });

  it("rejects an empty name", () => {
    expect(createGroupSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a name over 60 chars", () => {
    expect(createGroupSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
  });
});

describe("joinGroupSchema", () => {
  it("uppercases the invite code", () => {
    const r = joinGroupSchema.safeParse({ code: " ab12cd34 " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("AB12CD34");
  });

  it("rejects an empty code", () => {
    expect(joinGroupSchema.safeParse({ code: "" }).success).toBe(false);
  });
});

describe("groupIdSchema", () => {
  it("accepts a uuid", () => {
    expect(groupIdSchema.safeParse("00000000-0000-0000-0000-000000000000").success).toBe(true);
  });

  it("rejects a non-uuid", () => {
    expect(groupIdSchema.safeParse("nope").success).toBe(false);
  });
});
