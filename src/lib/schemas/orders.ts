import { z } from "zod";

import { idempotencyKey, optionalText, percent, quantity, requiredText } from "./common";

// The client sends only products, quantities and discounts. Prices, VAT and totals come from the database.
export const orderDraftSchema = z.object({
  customerId: requiredText("Odaberite kupca."),
  source: z.enum(["web", "olx", "viber", "telefon", "pos"]),
  note: optionalText,
  items: z
    .array(
      z.object({
        productId: requiredText("Odaberite proizvod."),
        quantity: quantity.positive("Količina mora biti veća od 0."),
        discountPercent: percent,
      }),
    )
    .min(1, "Dodajte barem jednu stavku."),
});

export const createOrderSchema = orderDraftSchema.extend({ idempotencyKey });

export const updateOrderDraftSchema = orderDraftSchema.extend({
  orderId: requiredText("Narudžba nije odabrana."),
});

export const orderActionSchema = z.object({
  idempotencyKey,
  orderId: requiredText("Narudžba nije odabrana."),
});

export const cancelOrderSchema = orderActionSchema.extend({
  reason: optionalText,
});

// Managers hand an order to a seller; the seller then sees and processes it.
export const assignOrderSchema = z.object({
  orderId: requiredText("Narudžba nije odabrana."),
  userId: z.uuid("Odaberite korisnika."),
});

export type OrderDraftInput = z.infer<typeof orderDraftSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderDraftInput = z.infer<typeof updateOrderDraftSchema>;
export type OrderActionInput = z.infer<typeof orderActionSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type AssignOrderInput = z.infer<typeof assignOrderSchema>;
