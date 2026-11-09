import { z } from "zod";

import { optionalText, percent, requiredText } from "./common";

export const settingsInputSchema = z.object({
  companyName: requiredText("Naziv firme je obavezan."),
  companyAddress: optionalText,
  companyJib: z.string().trim().regex(/^\d{13}$/, "JIB mora imati tačno 13 cifara.").or(z.literal("")),
  companyPdvNumber: z.string().trim().regex(/^\d{12}$/, "PDV broj mora imati tačno 12 cifara.").or(z.literal("")),
  // Printed on receipts and invoices (same limits as the check constraints in the database).
  companyCity: optionalText.max(100, "Najviše 100 znakova."),
  companyPhone: optionalText.max(50, "Najviše 50 znakova."),
  companyEmail: z.union([z.literal(""), z.email("Neispravna e-mail adresa.").max(200, "Najviše 200 znakova.")]),
  companyBankAccount: z
    .string()
    .trim()
    .regex(/^[0-9 -]{0,40}$/, "Žiro račun smije sadržavati samo cifre, razmake i crtice."),
  receiptFooter: optionalText.max(500, "Najviše 500 znakova."),
  defaultVatRate: percent,
  maxDiscountProdavac: percent,
  maxDiscountMenadzer: percent,
  invoiceDueDays: z
    .number({ error: "Unesite broj dana." })
    .int("Broj dana mora biti cijeli broj.")
    .min(0, "Broj dana ne može biti negativan.")
    .max(365, "Najviše 365 dana."),
});

export type SettingsInput = z.infer<typeof settingsInputSchema>;
