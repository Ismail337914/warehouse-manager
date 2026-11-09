import { describe, expect, it, vi } from "vitest";

import { dbErrorMessage } from "./db-errors";

describe("dbErrorMessage", () => {
  it("passes business messages from the database through", () => {
    expect(dbErrorMessage({ code: "P0001", message: "Nedovoljno dostupno: Laptop Pro 14 (dostupno 1, traženo 2)." })).toBe(
      "Nedovoljno dostupno: Laptop Pro 14 (dostupno 1, traženo 2).",
    );
  });

  it("keeps our own permission messages but hides PostgreSQL's", () => {
    expect(dbErrorMessage({ code: "42501", message: "Nemate ovlasti za ovu radnju." })).toBe("Nemate ovlasti za ovu radnju.");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(dbErrorMessage({ code: "42501", message: "permission denied for table products" })).toBe(
      "Nemate ovlasti za ovu radnju.",
    );
    expect(
      dbErrorMessage({ code: "42501", message: 'new row violates row-level security policy for table "customers"' }),
    ).toBe("Nemate ovlasti za ovu radnju.");
    log.mockRestore();
  });

  it("explains known unique constraints without exposing their names", () => {
    expect(
      dbErrorMessage({ code: "23505", message: 'duplicate key value violates unique constraint "products_sku_lower_key"' }),
    ).toBe("Proizvod s ovom šifrom već postoji.");
    expect(dbErrorMessage({ code: "23505", message: 'duplicate key value violates unique constraint "x_key"' })).toBe(
      "Zapis s ovim podacima već postoji.",
    );
  });

  it("explains why a supplier or category that is still used can't be deleted", () => {
    expect(
      dbErrorMessage({
        code: "23503",
        message:
          'update or delete on table "suppliers" violates foreign key constraint "goods_receipts_supplier_id_fkey" on table "goods_receipts"',
      }),
    ).toBe("Dobavljač ima prijeme robe i ne može se obrisati.");
    expect(
      dbErrorMessage({
        code: "23503",
        message: 'update or delete on table "categories" violates foreign key constraint "products_category_id_fkey" on table "products"',
      }),
    ).toBe("Kategorija ima proizvode i ne može se obrisati.");
    expect(dbErrorMessage({ code: "23503", message: 'violates foreign key constraint "x_fkey"' })).toBe(
      "Povezani zapis ne postoji ili se još koristi.",
    );
  });

  it("uses a generic message for anything unexpected and logs the details on the server", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(dbErrorMessage({ code: "XX000", message: "internal error in relation inventory_movements" })).toBe(
      "Radnja nije uspjela. Pokušajte ponovo.",
    );
    expect(dbErrorMessage({ message: "fetch failed" })).toBe("Radnja nije uspjela. Pokušajte ponovo.");
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({ scope: "db.unexpected", code: "XX000" });
    log.mockRestore();
  });

  it("does not log expected business outcomes", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    dbErrorMessage({ code: "P0001", message: "Nedovoljno dostupno." });
    dbErrorMessage({ code: "23505", message: 'duplicate key value violates unique constraint "x_key"' });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
