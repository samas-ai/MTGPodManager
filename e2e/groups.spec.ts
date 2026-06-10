import { test, expect } from "@playwright/test";

/**
 * F1 happy-path skeleton: sign up → create a pod → generate an invite → a second
 * browser context joins with the code and sees the pod.
 *
 * Requires a running app against a live Supabase project with email confirmation
 * DISABLED (so sign-up yields a session). Set E2E_RUN=1 to enable. Until then
 * the suite skips so `npm run test:e2e` stays green in CI without a backend.
 */
test.skip(process.env.E2E_RUN !== "1", "Set E2E_RUN=1 with a live Supabase env to run F1 e2e.");

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}@example.com`;
}

test("host creates a pod, invitee joins via code", async ({ browser }) => {
  const host = await browser.newContext();
  const hostPage = await host.newPage();

  // --- Host signs up ---
  await hostPage.goto("/sign-up");
  await hostPage.getByLabel("Display name").fill("Host Player");
  await hostPage.getByLabel("Email").fill(unique("host"));
  await hostPage.getByLabel("Password").fill("supersecret");
  await hostPage.getByRole("button", { name: "Sign up" }).click();

  // --- Host creates a pod ---
  await hostPage.getByLabel("Pod name").fill("E2E Pod");
  await hostPage.getByRole("button", { name: "Create pod" }).click();
  await expect(hostPage.getByRole("heading", { name: "E2E Pod" })).toBeVisible();

  // --- Host generates an invite code ---
  await hostPage.getByRole("button", { name: "Generate invite code" }).click();
  const code = (await hostPage.locator("p.font-mono").innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);

  // --- Invitee joins from a separate context ---
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto("/sign-up");
  await guestPage.getByLabel("Display name").fill("Guest Player");
  await guestPage.getByLabel("Email").fill(unique("guest"));
  await guestPage.getByLabel("Password").fill("supersecret");
  await guestPage.getByRole("button", { name: "Sign up" }).click();

  await guestPage.getByLabel("Invite code").fill(code);
  await guestPage.getByRole("button", { name: "Join pod" }).click();
  await expect(guestPage.getByRole("heading", { name: "E2E Pod" })).toBeVisible();

  await host.close();
  await guest.close();
});
