import { z } from "zod";

import { optionalText, percent, price, quantity, requiredText } from "./common";

// Product master data. Stock is never part of this form: it changes only through receipts, corrections,
// stock counts and orders. Prices are net (bez PDV-a).
export const productInputSchema = z.object({
  sku: requiredText("Šifra je obavezna.").max(64, "Šifra može imati najviše 64 znaka."),
  barcode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z-]{4,64}$/, "Barkod smije sadržavati samo slova, brojeve i crticu (4–64 znaka).")
    .or(z.literal("")),
  oemNumber: optionalText.max(128, "OEM/kataloški broj može imati najviše 128 znakova."),
  name: requiredText("Naziv je obavezan."),
  categoryId: z.number({ error: "Odaberite kategoriju." }).int().positive("Odaberite kategoriju."),
  description: optionalText,
  buyPrice: price,
  sellPrice: price,
  vatRate: percent,
  minQuantity: quantity.min(0, "Minimalna zaliha ne može biti negativna."),
  unit: requiredText("Jedinica mjere je obavezna."),
  location: requiredText("Lokacija je obavezna."),
  status: z.enum(["active", "inactive"]),
});

export const categoryInputSchema = z.object({
  name: requiredText("Naziv kategorije je obavezan.").max(100, "Najviše 100 znakova."),
});

// Same rules as the check constraints on public.suppliers (…_suppliers_employees.sql) and as customers.
export const supplierInputSchema = z.object({
  name: requiredText("Naziv dobavljača je obavezan.").max(200, "Najviše 200 znakova."),
  jib: z.string().trim().regex(/^\d{13}$/, "JIB mora imati tačno 13 cifara.").or(z.literal("")),
  pdvNumber: z.string().trim().regex(/^\d{12}$/, "PDV broj mora imati tačno 12 cifara.").or(z.literal("")),
  address: optionalText.max(200, "Najviše 200 znakova."),
  city: optionalText.max(100, "Najviše 100 znakova."),
  phone: optionalText.max(50, "Najviše 50 znakova."),
  email: z.union([z.literal(""), z.email("Neispravna e-mail adresa.")]),
  note: optionalText.max(1000, "Najviše 1000 znakova."),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type SupplierInput = z.infer<typeof supplierInputSchema>;
