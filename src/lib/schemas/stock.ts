import { z } from "zod";

import { idempotencyKey, optionalText, price, quantity, requiredText } from "./common";

export const receiveStockSchema = z.object({
  idempotencyKey,
  supplierId: optionalText,
  documentNumber: optionalText,
  note: optionalText,
  items: z
    .array(
      z.object({
        productId: requiredText("Odaberite proizvod."),
        quantity: quantity.positive("Količina mora biti veća od 0."),
        unitCost: price,
      }),
    )
    .min(1, "Dodajte barem jednu stavku prijema."),
});

export const adjustStockSchema = z.object({
  idempotencyKey,
  productId: requiredText("Odaberite proizvod."),
  quantityChange: quantity.refine((value) => value !== 0, "Promjena količine ne može biti 0."),
  reason: requiredText("Razlog korekcije je obavezan."),
});

export const stockCountSchema = z.object({
  idempotencyKey,
  reason: requiredText("Razlog inventure je obavezan."),
  items: z
    .array(
      z.object({
        productId: requiredText("Odaberite proizvod."),
        countedQuantity: quantity.min(0, "Prebrojana količina ne može biti negativna."),
      }),
    )
    .min(1, "Dodajte barem jedan proizvod."),
});

export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type StockCountInput = z.infer<typeof stockCountSchema>;
