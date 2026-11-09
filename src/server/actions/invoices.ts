"use server";

import { z } from "zod";

import {
  invoiceOrderSchema,
  invoicePosSaleSchema,
  recordPaymentSchema,
  stornoInvoiceSchema,
  type InvoiceOrderInput,
  type InvoicePosSaleInput,
  type RecordPaymentInput,
  type StornoInvoiceInput,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/server/auth";
import { dbErrorMessage } from "@/server/db-errors";
import { invalidInput, type ActionResult } from "@/server/result";

// Shape returned by every invoice RPC (private.invoice_result in the database).
const invoiceResultSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: z.enum(["izdata", "djelimicno_placena", "placena", "stornirana"]),
  total: z.number(),
  paid_amount: z.number(),
  storno_of: z.string().nullable(),
});

export type InvoiceResult = z.infer<typeof invoiceResultSchema>;

function toResult(data: unknown, error: { code?: string; message: string } | null): ActionResult<InvoiceResult> {
  if (error) return { ok: false, error: dbErrorMessage(error) };
  const parsed = invoiceResultSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Neočekivan odgovor baze." };
  return { ok: true, data: parsed.data };
}

export async function invoiceOrder(input: InvoiceOrderInput): Promise<ActionResult<InvoiceResult>> {
  const auth = await authorize("invoices.issue");
  if (!auth.ok) return auth;

  const parsed = invoiceOrderSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invoice_order", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_order_id: parsed.data.orderId,
  });
  return toResult(data, error);
}

export async function invoicePosSale(input: InvoicePosSaleInput): Promise<ActionResult<InvoiceResult>> {
  const auth = await authorize("invoices.issue");
  if (!auth.ok) return auth;

  const parsed = invoicePosSaleSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invoice_pos_sale", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_pos_sale_id: parsed.data.posSaleId,
  });
  return toResult(data, error);
}

export async function recordPayment(input: RecordPaymentInput): Promise<ActionResult<InvoiceResult>> {
  const auth = await authorize("payments.record");
  if (!auth.ok) return auth;

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const { idempotencyKey, invoiceId, amount, method, paidOn, note } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_payment", {
    p_idempotency_key: idempotencyKey,
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_method: method,
    p_paid_on: paidOn,
    p_note: note,
  });
  return toResult(data, error);
}

export async function stornoInvoice(input: StornoInvoiceInput): Promise<ActionResult<InvoiceResult>> {
  const auth = await authorize("invoices.storno");
  if (!auth.ok) return auth;

  const parsed = stornoInvoiceSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("storno_invoice", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_invoice_id: parsed.data.invoiceId,
    p_reason: parsed.data.reason,
  });
  return toResult(data, error);
}
