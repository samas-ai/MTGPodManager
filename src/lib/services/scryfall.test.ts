import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCommanders } from "./scryfall";

function mockFetchOnce(impl: (url: string, init?: RequestInit) => unknown) {
  const fn = vi.fn(impl as (...args: unknown[]) => unknown);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveCommanders", () => {
  it("resolves color identity and sends required headers", async () => {
    const fn = mockFetchOnce(() => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ id: "sf-1", name: "Atraxa, Praetors' Voice", color_identity: ["W", "U", "B", "G"] }],
        not_found: [],
      }),
    }));

    const r = await resolveCommanders(["Atraxa, Praetors' Voice"]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data[0]?.scryfallId).toBe("sf-1");
      expect(r.data[0]?.colorIdentity).toEqual(["W", "U", "B", "G"]);
    }

    // Etiquette: User-Agent + Accept headers present.
    const init = fn.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBeTruthy();
    expect(headers["Accept"]).toBe("application/json");
  });

  it("errors when the commander is not found (empty data)", async () => {
    mockFetchOnce(() => ({ ok: true, status: 200, json: async () => ({ data: [], not_found: [{ name: "X" }] }) }));
    const r = await resolveCommanders(["Nonexistent Commander"]);
    expect(r.ok).toBe(false);
  });

  it("errors on a non-OK response", async () => {
    mockFetchOnce(() => ({ ok: false, status: 503, json: async () => ({}) }));
    const r = await resolveCommanders(["Atraxa"]);
    expect(r.ok).toBe(false);
  });

  it("errors with no names", async () => {
    const r = await resolveCommanders([]);
    expect(r.ok).toBe(false);
  });
});
