import { test, expect } from "@playwright/test";

/**
 * The golden path — the product's entire verified-logging loop in one journey:
 * two players sign up → pod + invite + join → register decks → host starts a
 * match and verifies → guest joins and verifies (host sees it live via
 * realtime/polling, no reload) → host finalizes → stats reflect the result.
 *
 * Requires a running app against a live Supabase stack with email confirmation
 * DISABLED. Set E2E_RUN=1 to enable (CI does; see ci.yml).
 */
test.skip(process.env.E2E_RUN !== "1", "Set E2E_RUN=1 with a live Supabase env to run e2e.");

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}@example.com`;
}

test("golden path: pod → decks → match → verify → finalize → stats", async ({ browser }) => {
  test.setTimeout(120_000);

  // --- Host signs up and creates the pod --------------------------------------
  const host = await browser.newContext();
  const hostPage = await host.newPage();
  await hostPage.goto("/sign-up");
  await hostPage.getByLabel("Display name").fill("Host Player");
  await hostPage.getByLabel("Email").fill(unique("gp-host"));
  await hostPage.getByLabel("Password").fill("supersecret");
  await hostPage.getByRole("button", { name: "Sign up" }).click();

  await hostPage.getByLabel("Pod name").fill("Golden Pod");
  await hostPage.getByRole("button", { name: "Create pod" }).click();
  await expect(hostPage.getByRole("heading", { name: "Golden Pod" })).toBeVisible();
  const podUrl = hostPage.url();

  await hostPage.getByRole("button", { name: "Generate invite code" }).click();
  const code = (await hostPage.locator("p.font-mono").innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);

  // --- Host registers a deck ---------------------------------------------------
  await hostPage.goto("/profile/decks");
  await hostPage.getByLabel("Deck name").fill("Host Deck");
  await hostPage.getByLabel("Commander").fill("Atraxa, Praetors' Voice");
  await hostPage.getByRole("button", { name: "Add deck" }).click();
  await expect(hostPage.getByText("Host Deck")).toBeVisible();

  // --- Guest signs up, joins the pod, registers a deck -------------------------
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto("/sign-up");
  await guestPage.getByLabel("Display name").fill("Guest Player");
  await guestPage.getByLabel("Email").fill(unique("gp-guest"));
  await guestPage.getByLabel("Password").fill("supersecret");
  await guestPage.getByRole("button", { name: "Sign up" }).click();

  await guestPage.getByLabel("Invite code").fill(code);
  await guestPage.getByRole("button", { name: "Join pod" }).click();
  await expect(guestPage.getByRole("heading", { name: "Golden Pod" })).toBeVisible();

  await guestPage.goto("/profile/decks");
  await guestPage.getByLabel("Deck name").fill("Guest Deck");
  await guestPage.getByLabel("Commander").fill("Krenko, Mob Boss");
  await guestPage.getByRole("button", { name: "Add deck" }).click();
  await expect(guestPage.getByText("Guest Deck")).toBeVisible();

  // --- Host starts the match and verifies their own deck -----------------------
  await hostPage.goto(podUrl);
  await hostPage.getByRole("button", { name: "Start match" }).click();
  await expect(hostPage.getByRole("heading", { name: "Live match" })).toBeVisible();

  await hostPage.getByLabel("Your deck").selectOption({ index: 1 });
  await hostPage.getByRole("button", { name: "Confirm deck & verify" }).click();
  await expect(hostPage.getByText("1/1 verified")).toBeVisible();

  // --- Guest joins the match and verifies --------------------------------------
  await guestPage.goto(podUrl);
  await guestPage.getByRole("link", { name: "Join match" }).click();
  await guestPage.getByLabel("Your deck").selectOption({ index: 1 });
  await guestPage.getByRole("button", { name: "Confirm deck & verify" }).click();

  // The host screen updates WITHOUT a reload (realtime or 3s polling) — this
  // asserts the live join-status loop, the product's core differentiator.
  await expect(hostPage.getByText("2/2 verified")).toBeVisible({ timeout: 15_000 });

  // --- Host finalizes with the guest as winner ----------------------------------
  await hostPage.getByLabel("Winner").selectOption({ label: "Guest Player" });
  await hostPage.getByRole("button", { name: "Finalize match" }).click();
  await expect(hostPage.getByText("Match recorded.")).toBeVisible();

  // --- Stats reflect the result --------------------------------------------------
  await expect(hostPage.getByText("1. Guest Player")).toBeVisible();
  await hostPage.getByRole("link", { name: "Full stats →" }).click();
  await expect(hostPage.getByRole("heading", { name: /Stats/ })).toBeVisible();
  // The deck shows in both Most-played and Deck-win-rates sections — .first()
  // avoids the strict-mode ambiguity; either occurrence proves the stats read.
  await expect(hostPage.getByText("Guest Deck · Krenko, Mob Boss").first()).toBeVisible();

  await host.close();
  await guest.close();
});
