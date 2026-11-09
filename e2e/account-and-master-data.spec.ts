import { expect, test } from "@playwright/test";

import { login, PASSWORD } from "./helpers";

test("manager adds a supplier and books a goods receipt from it", async ({ page }) => {
  await login(page, "menadzer");
  const name = `E2E dobavljač ${Date.now()}`;

  await page.goto("/warehouse");
  await page.getByRole("link", { name: "Dobavljači" }).click();
  await page.getByLabel("Naziv", { exact: true }).fill(name);
  await page.getByLabel("Grad").fill("Zenica");
  await page.getByRole("button", { name: "Dodaj dobavljača" }).click();
  await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();

  // The new supplier is offered in the receipt; another one can be added there directly.
  await page.goto("/warehouse/receipts/new");
  const supplierSelect = page.getByLabel("Dobavljač", { exact: true });
  await expect(supplierSelect).toContainText(name);
  await page.getByRole("button", { name: "+ Novi dobavljač" }).click();
  const quickName = `${name} brzi`;
  await page.getByLabel("Naziv novog dobavljača").fill(quickName);
  await page.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(supplierSelect.locator("option:checked")).toHaveText(quickName);
});

test("user changes their password and changes it back", async ({ page }) => {
  const newPassword = "Promjena123";
  await login(page, "menadzer");

  const change = async (current: string, next: string) => {
    await page.goto("/account/password");
    await page.getByLabel("Trenutna lozinka").fill(current);
    await page.getByLabel("Nova lozinka", { exact: true }).fill(next);
    await page.getByLabel("Ponovite novu lozinku").fill(next);
    await page.getByRole("button", { name: "Promijeni lozinku" }).click();
  };

  // A wrong current password is refused.
  await change(`${PASSWORD}x`, newPassword);
  await expect(page.getByText("Trenutna lozinka nije tačna.").first()).toBeVisible();

  await change(PASSWORD, newPassword);
  await expect(page.getByText("Lozinka je promijenjena.")).toBeVisible();
  // Back to the seeded password, so the other tests keep working.
  await change(newPassword, PASSWORD);
  await expect(page.getByText("Lozinka je promijenjena.")).toBeVisible();
});

test("an unknown address shows the Bosnian 404 page", async ({ page }) => {
  await login(page, "prodavac");
  await page.goto("/ova-stranica-ne-postoji");
  await expect(page.getByRole("heading", { name: "Stranica ne postoji" })).toBeVisible();
  await page.getByRole("link", { name: "Na početnu" }).click();
  await expect(page.getByText("Moji rezultati")).toBeVisible();
});
