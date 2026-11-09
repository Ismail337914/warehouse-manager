import { z } from "zod";

import { idempotencyKey, optionalText, requiredText } from "./common";
import { paymentMethodSchema } from "./pos";

export const invoiceOrderSchema = z.object({
  idempotencyKey,
  orderId: requiredText("Narudžba nije odabrana."),
});

export const invoicePosSaleSchema = z.object({
  idempotencyKey,
  posSaleId: requiredText("Prodaja nije odabrana."),
});

export const paymentFormSchema = z.object({
  amount: z.number({ error: "Unesite iznos." }).positive("Iznos uplate mora biti veći od 0."),
  method: paymentMethodSchema,
  paidOn: z.iso.date("Unesite datum uplate."),
  note: optionalText,
});

export const recordPaymentSchema = paymentFormSchema.extend({
  idempotencyKey,
  invoiceId: requiredText("Faktura nije odabrana."),
});

export const stornoInvoiceSchema = z.object({
  idempotencyKey,
  invoiceId: requiredText("Faktura nije odabrana."),
  reason: optionalText,
});

export type InvoiceOrderInput = z.infer<typeof invoiceOrderSchema>;
export type InvoicePosSaleInput = z.infer<typeof invoicePosSaleSchema>;
export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type StornoInvoiceInput = z.infer<typeof stornoInvoiceSchema>;
