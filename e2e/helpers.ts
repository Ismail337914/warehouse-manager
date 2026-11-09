import { expect, type Page } from "@playwright/test";

// Seeded users (supabase/seed.sql, local database only).
export const users = {
  admin: { email: "admin@demo.ba", id: "00000000-0000-4000-8000-000000000001" },
  menadzer: { email: "menadzer@demo.ba", id: "00000000-0000-4000-8000-000000000002" },
  prodavac: { email: "prodavac@demo.ba", id: "00000000-0000-4000-8000-000000000003" },
} as const;

export type Role = keyof typeof users;

export const PASSWORD = "Demo1234";

export async function login(page: Page, role: Role) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(users[role].email);
  await page.getByLabel("Lozinka", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Prijavi se" }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("button", { name: "Odjava" })).toBeVisible();
}

export function sidebar(page: Page) {
  // The desktop sidebar; the mobile menu renders the same links inside a dialog.
  return page.locator("nav").first();
}

// "3.734,70 KM" → 3734.7
export function parseMoney(value: string) {
  return Number(value.replace(/[^\d,-]/g, "").replace(",", "."));
}
