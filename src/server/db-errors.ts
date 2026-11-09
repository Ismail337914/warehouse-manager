// Turns a database error into a message for the user. Business rules in the database raise P0001 with a
// Bosnian message meant for the user; everything else gets a generic message, so table and constraint names
// never reach the UI. Errors that are not expected business outcomes are logged on the server (src/server/log.ts).

import { logServerError } from "./log";

type DbError = { code?: string; message: string; details?: string | null; hint?: string | null };

const uniqueConstraintMessages: Record<string, string> = {
  products_sku_lower_key: "Proizvod s ovom šifrom već postoji.",
  products_barcode_key: "Proizvod s ovim barkodom već postoji.",
  customers_jib_key: "Kupac s ovim JIB-om već postoji.",
  categories_name_key: "Kategorija s ovim nazivom već postoji.",
  suppliers_name_key: "Dobavljač s ovim nazivom već postoji.",
  suppliers_jib_key: "Dobavljač s ovim JIB-om već postoji.",
  invoices_order_id_active_key: "Narudžba je već fakturisana.",
  invoices_pos_sale_id_active_key: "Prodaja je već fakturisana.",
};

// A row that other records still point to (ON DELETE RESTRICT). Matched by the referencing constraint's name.
const foreignKeyMessages: Record<string, string> = {
  goods_receipts_supplier_id_fkey: "Dobavljač ima prijeme robe i ne može se obrisati.",
  procurement_docs_supplier_id_fkey: "Dobavljač ima dokumente nabavke i ne može se obrisati.",
  products_category_id_fkey: "Kategorija ima proizvode i ne može se obrisati.",
};

export function dbErrorMessage(error: DbError) {
  switch (error.code) {
    case "P0001":
      return error.message;
    case "42501":
      // Our own guards raise 42501 with a Bosnian message. PostgreSQL's own messages ("permission denied for
      // table …", "new row violates row-level security policy for table …") name tables, so they are replaced.
      if (error.message.startsWith("permission denied") || error.message.includes("row-level security")) {
        logServerError("db.permission", error);
        return "Nemate ovlasti za ovu radnju.";
      }
      return error.message;
    case "23505": {
      const constraint = Object.keys(uniqueConstraintMessages).find((name) => error.message.includes(name));
      return constraint ? uniqueConstraintMessages[constraint] : "Zapis s ovim podacima već postoji.";
    }
    case "23503": {
      const text = `${error.message} ${error.details ?? ""}`;
      const constraint = Object.keys(foreignKeyMessages).find((name) => text.includes(name));
      return constraint ? foreignKeyMessages[constraint] : "Povezani zapis ne postoji ili se još koristi.";
    }
    case "23514":
      return "Podaci nisu ispravni.";
    case "22P02":
      return "Neispravan format podataka.";
    default:
      // Unexpected: a bug, a missing migration or an outage. The user gets a generic message, the log the details.
      logServerError("db.unexpected", error);
      return "Radnja nije uspjela. Pokušajte ponovo.";
  }
}
