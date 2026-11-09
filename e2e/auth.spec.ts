import { expect, test } from "@playwright/test";

import { login, PASSWORD, type Role } from "./helpers";

test.describe("sign-in and sign-out", () => {
  for (const role of ["admin", "menadzer", "prodavac"] as const satisfies Role[]) {
    test(`${role} signs in to the dashboard and signs out`, async ({ page }) => {
      await login(page, role);
      // Staff land on the company dashboard, a seller on their own results.
      await expect(page.getByText(role === "prodavac" ? "Moji rezultati" : "Pregled poslovanja")).toBeVisible();

      await page.getByRole("button", { name: "Odjava" }).click();
      await page.waitForURL("/login");

      // The session is gone: the app sends the visitor back to the login page.
      await page.goto("/orders");
      await expect(page).toHaveURL(/\/login\?next=%2Forders/);
    });
  }

  test("shows the same message for an unknown account and a wrong password", async ({ page }) => {
    await page.goto("/login");
    // A random address, so the attempt counter never locks a real account.
    await page.getByLabel("E-mail").fill(`nepostoji-${Date.now()}@demo.ba`);
    await page.getByLabel("Lozinka", { exact: true }).fill(`${PASSWORD}x`);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page.getByText("Pogrešan e-mail ili lozinka.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("rejects invalid input before it reaches the server", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("nije-email");
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await expect(page.getByText("Neispravna e-mail adresa.")).toBeVisible();
  });

  test("sends visitors without a session to the login page and back after signing in", async ({ page }) => {
    await page.goto("/pos");
    await expect(page).toHaveURL(/\/login\?next=%2Fpos/);

    await page.getByLabel("E-mail").fill("prodavac@demo.ba");
    await page.getByLabel("Lozinka", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Prijavi se" }).click();
    await page.waitForURL("/pos");
    await expect(page.getByText("Prodajna kasa")).toBeVisible();
  });

  test("password reset answers the same whether or not the account exists", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("E-mail").fill(`reset-${Date.now()}@demo.ba`);
    await page.getByRole("button", { name: "Pošalji link" }).click();
    await expect(page.getByText("Ako nalog s tom adresom postoji")).toBeVisible();
  });

  test("shows or hides the password on request", async ({ page }) => {
    await page.goto("/login");
    const password = page.getByLabel("Lozinka", { exact: true });
    await password.fill(PASSWORD);
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Prikaži lozinku" }).click();
    await expect(password).toHaveAttribute("type", "text");
  });
});
