import { expect, test } from "@playwright/test";

import { login, parseMoney, users } from "./helpers";

test("seller: POS sale by barcode updates their dashboard", async ({ page }) => {
  await login(page, "prodavac");
  const turnover = page.getByText("Moj promet danas").locator("xpath=following-sibling::p[1]");
  const before = parseMoney(await turnover.innerText());

  await page.goto("/pos");
  const scanner = page.getByLabel("Naziv, šifra ili barkod (Enter dodaje u korpu)");
  await scanner.fill("3870000010214");
  await scanner.press("Enter");
  await expect(page.getByRole("button", { name: "Ukloni Laptop Pro 14 iz korpe" })).toBeVisible();

  await page.getByRole("button", { name: "Naplati" }).click();
  const confirmation = page.getByText(/Prodaja P-\d{4,}\/\d{4} je naplaćena/);
  await expect(confirmation).toBeVisible();
  const total = parseMoney((await confirmation.innerText()).split(":")[1]);

  await page.goto("/");
  await expect.poll(async () => parseMoney(await turnover.innerText())).toBeCloseTo(before + total, 2);
});

test("seller prints the POS receipt right after the sale", async ({ page }) => {
  // Count print dialogs instead of opening one.
  await page.addInitScript(() => {
    const target = window as unknown as { printCalls: number };
    target.printCalls = 0;
    window.print = () => {
      target.printCalls += 1;
    };
  });
  await login(page, "prodavac");

  await page.goto("/pos");
  const scanner = page.getByLabel("Naziv, šifra ili barkod (Enter dodaje u korpu)");
  await scanner.fill("3870000010214");
  await scanner.press("Enter");
  await expect(page.getByRole("button", { name: "Ukloni Laptop Pro 14 iz korpe" })).toBeVisible();
  await page.getByRole("button", { name: "Naplati" }).click();

  const confirmation = page.getByText(/Prodaja P-\d{4,}\/\d{4} je naplaćena/);
  await expect(confirmation).toBeVisible();
  const number = (await confirmation.innerText()).match(/P-\d{4,}\/\d{4}/)?.[0] ?? "";
  await page.getByRole("status").filter({ hasText: number }).getByRole("link", { name: "Štampaj račun" }).click();

  await expect(page).toHaveURL(/\/pos\/[^/]+\/print\?print=1$/);
  await expect(page.getByText(`Račun ${number}`)).toBeVisible();
  // The receipt always says that it is not a fiscal receipt (cash sales also need a certified fiscal device).
  await expect(page.getByText(/nije fiskalni/i)).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printCalls: number }).printCalls)).toBe(1);
});

test("manager assigns an order; the seller then sees it", async ({ browser }) => {
  const manager = await browser.newPage();
  await login(manager, "menadzer");
  await manager.goto("/orders/ORD-1026");
  const assignee = manager.getByLabel("Prodavač");
  const assign = manager.getByRole("button", { name: "Dodijeli" });
  // First to the manager, then to the seller: the second step always changes something, so the test also
  // passes when an earlier run (without npm run db:reset) already gave the order to the seller.
  for (const user of [users.menadzer, users.prodavac]) {
    await assignee.selectOption(user.id);
    await assign.click();
    await expect(assign).toBeDisabled();
  }
  await manager.close();

  const seller = await browser.newPage();
  await login(seller, "prodavac");
  // Searched, so the order is found even when other tests (npm run test:db) added many newer ones.
  await seller.goto("/orders?q=SO-1026");
  await expect(seller.getByRole("link", { name: "SO-1026" })).toBeVisible();
  await seller.goto("/orders/ORD-1026");
  await expect(seller.getByText("Narudžba je dodijeljena vama.")).toBeVisible();
  await seller.close();
});

test("only an admin is offered storno on an invoice", async ({ browser }) => {
  // POS invoice 0002/2026 from the seed: paid at the till, no recorded payments, so it can be cancelled.
  const manager = await browser.newPage();
  await login(manager, "menadzer");
  await manager.goto("/invoices?q=0002%2F2026");
  await manager.getByRole("link", { name: "0002/2026" }).click();
  await expect(manager.getByRole("link", { name: "Štampaj" })).toBeVisible();
  await expect(manager.getByRole("button", { name: "Storniraj" })).toHaveCount(0);
  await manager.close();

  const admin = await browser.newPage();
  await login(admin, "admin");
  await admin.goto("/invoices?q=0002%2F2026");
  await admin.getByRole("link", { name: "0002/2026" }).click();
  await expect(admin.getByRole("button", { name: "Storniraj" })).toBeVisible();
  await admin.close();
});
