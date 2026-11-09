import { z } from "zod";

import { optionalText, requiredText } from "./common";

export const customerInputSchema = z
  .object({
    customerType: z.enum(["fizicko", "pravno"]),
    name: requiredText("Ime ili naziv je obavezno."),
    // JIB: 13 digits, required for companies. PDV broj: 12 digits, only for VAT-registered companies.
    jib: z.string().trim().regex(/^\d{13}$/, "JIB mora imati tačno 13 cifara.").or(z.literal("")),
    pdvNumber: z.string().trim().regex(/^\d{12}$/, "PDV broj mora imati tačno 12 cifara.").or(z.literal("")),
    phone: optionalText,
    email: z.union([z.literal(""), z.email("Neispravna e-mail adresa.")]),
    address: optionalText,
    city: optionalText,
    notes: optionalText,
  })
  .refine((customer) => customer.customerType === "fizicko" || customer.jib !== "", {
    message: "JIB je obavezan za pravno lice.",
    path: ["jib"],
  });

export type CustomerInput = z.infer<typeof customerInputSchema>;
