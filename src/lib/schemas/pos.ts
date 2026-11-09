import { z } from "zod";

import { idempotencyKey, percent, quantity, requiredText } from "./common";

export const paymentMethodSchema = z.enum(["gotovina", "kartica", "virman"], { error: "Odaberite način plaćanja." });

// The till sends products, quantities and one discount for the receipt. Prices and totals come from the database.
export const posSaleSchema = z.object({
  idempotencyKey,
  customerId: z.string().trim(),
  paymentMethod: paymentMethodSchema,
  discountPercent: percent,
  items: z
    .array(
      z.object({
        productId: requiredText("Odaberite proizvod."),
        quantity: quantity.positive("Količina mora biti veća od 0."),
      }),
    )
    .min(1, "Korpa je prazna."),
});

export type PosSaleInput = z.infer<typeof posSaleSchema>;
