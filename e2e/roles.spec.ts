import { expect, test, type Page } from "@playwright/test";

import { login, sidebar } from "./helpers";

const allModules = [
  "Pregled",
  "Lager",
  "POS / Prodaja",
  "Pregled prodaja",
  "Fakture",
  "Narudžbe",
  "Oglasi",
  "Kupci",
  "Rezervacije",
  "Zaposlenici",
  "Izvještaji",
  "Postavke",
];

// Hidden until they do something real; they must not come back in the menu for anyone.
const removedModules = ["Nabavka", "Integracije"];

async function expectMenu(page: Page, visible: string[]) {
  const nav = sidebar(page);
  for (const label of [...allModules, ...removedModules]) {
    const link = nav.getByRole("link", { name: label, exact: true });
    if (visible.includes(label)) await expect(link, label).toBeVisible();
    else await expect(link, label).toHaveCount(0);
  }
}

async function expectForbidden(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByText("Nemate pristup"), path).toBeVisible();
}

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => login(page, "admin"));

  test("sees every module and opens user management and the audit log", async ({ page }) => {
    await expectMenu(page, allModules);

    await page.goto("/settings/users");
    await expect(page.getByText("Novi korisnik")).toBeVisible();

    await page.goto("/settings/audit");
    await expect(page.getByText("Audit log", { exact: true })).toBeVisible();
    // Seeded accounts were created through the profile trigger, which writes the first audit entries.
    await expect(page.getByRole("cell", { name: /Korisnik kreiran/ }).first()).toBeVisible();
  });
});

test.describe("menadžer", () => {
  test.beforeEach(async ({ page }) => login(page, "menadzer"));

  test("sees operations but not user management or the audit log", async ({ page }) => {
    await expectMenu(page, allModules);
    await expectForbidden(page, "/settings/users");
    await expectForbidden(page, "/settings/audit");
  });

  test("sees purchase prices and the stock history", async ({ page }) => {
    await page.goto("/warehouse/PRD-1021");
    await expect(page.getByLabel("Nabavna cijena (KM, bez PDV-a)")).toHaveValue("980");
    await expect(page.getByText("Historija kretanja")).toBeVisible();
  });
});

test.describe("prodavač", () => {
  test.beforeEach(async ({ page }) => login(page, "prodavac"));

  test("sees only the selling modules", async ({ page }) => {
    await expectMenu(page, ["Pregled", "Lager", "POS / Prodaja", "Pregled prodaja", "Fakture", "Narudžbe", "Kupci", "Rezervacije"]);
    await expect(page.getByText("Moji rezultati")).toBeVisible();
  });

  test("is refused suppliers, categories, ads, settings, employees, reports and stock documents, even by URL", async ({ page }) => {
    for (const path of [
      "/warehouse/suppliers",
      "/warehouse/categories",
      "/ads",
      "/settings",
      "/settings/users",
      "/settings/audit",
      "/employees",
      "/reports",
      "/warehouse/new",
      "/warehouse/receipts/new",
      "/warehouse/adjustments/new",
    ]) {
      await expectForbidden(page, path);
    }
  });

  test("sees sale prices and availability, but no purchase prices or stock history", async ({ page }) => {
    await page.goto("/warehouse/PRD-1021");
    await expect(page.getByText("Dostupno za prodaju")).toBeVisible();
    await expect(page.getByLabel("Prodajna cijena (KM, bez PDV-a)")).toHaveValue("1299");
    await expect(page.getByText("Nabavna cijena")).toHaveCount(0);
    await expect(page.getByText("Historija kretanja")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Spremi izmjene" })).toHaveCount(0);
  });

  test("sees only their own orders", async ({ page }) => {
    // Searched, so the seeded orders are found even when other tests (npm run test:db) added many newer ones.
    await page.goto("/orders?q=SO-102");
    await expect(page.getByText("Moje narudžbe")).toBeVisible();
    await expect(page.getByRole("link", { name: "SO-1028" })).toBeVisible();
    await expect(page.getByRole("link", { name: "SO-1025" })).toHaveCount(0);

    // Someone else's order, opened by URL: the database returns nothing.
    await page.goto("/orders/ORD-1025");
    await expect(page.getByText("Narudžba ne postoji.")).toBeVisible();
  });

  test("can't edit an existing customer", async ({ page }) => {
    await page.goto("/customers/CUS-1001");
    await expect(page.getByLabel("Naziv firme")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Spremi izmjene" })).toHaveCount(0);
  });
});
