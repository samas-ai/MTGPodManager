import { describe, expect, it } from "vitest";
import { safePath } from "./safe-path";

describe("safePath", () => {
  it("allows a normal internal path", () => {
    expect(safePath("/match/123/host", "/groups")).toBe("/match/123/host");
  });
  it("rejects protocol-relative URLs (open-redirect)", () => {
    expect(safePath("//evil.com", "/groups")).toBe("/groups");
  });
  it("rejects backslash-prefixed URLs", () => {
    expect(safePath("/\\evil.com", "/groups")).toBe("/groups");
  });
  it("rejects absolute external URLs", () => {
    expect(safePath("https://evil.com", "/groups")).toBe("/groups");
  });
  it("rejects non-strings", () => {
    expect(safePath(null, "/groups")).toBe("/groups");
    expect(safePath(undefined, "/groups")).toBe("/groups");
  });
});
