"use server";

import { z } from "zod";

import {
  assignOrderSchema,
  cancelOrderSchema,
  createOrderSchema,
  orderActionSchema,
  updateOrderDraftSchema,
  type AssignOrderInput,
  type CancelOrderInput,
  type CreateOrderInput,
  type OrderActionInput,
  type OrderDraftInput,
  type UpdateOrderDraftInput,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/server/auth";
import { dbErrorMessage } from "@/server/db-errors";
import { invalidInput, type ActionResult } from "@/server/result";

// Shape returned by every order RPC (private.order_result in the database).
const orderResultSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: z.enum(["nacrt", "potvrđena", "isporučena", "fakturisana", "otkazana"]),
  subtotal: z.number(),
  vat_total: z.number(),
  total: z.number(),
});

export type OrderResult = z.infer<typeof orderResultSchema>;

function toRpcItems(items: OrderDraftInput["items"]) {
  return items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
    discount_percent: item.discountPercent,
  }));
}

function toResult(data: unknown, error: { code?: string; message: string } | null): ActionResult<OrderResult> {
  if (error) return { ok: false, error: dbErrorMessage(error) };
  const parsed = orderResultSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "Neočekivan odgovor baze." };
  return { ok: true, data: parsed.data };
}

export async function createOrder(input: CreateOrderInput): Promise<ActionResult<OrderResult>> {
  const auth = await authorize("orders.create");
  if (!auth.ok) return auth;

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const { idempotencyKey, customerId, source, note, items } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_idempotency_key: idempotencyKey,
    p_customer_id: customerId,
    p_source: source,
    p_note: note,
    p_items: toRpcItems(items),
  });
  return toResult(data, error);
}

export async function updateOrderDraft(input: UpdateOrderDraftInput): Promise<ActionResult<OrderResult>> {
  const auth = await authorize("orders.process");
  if (!auth.ok) return auth;

  const parsed = updateOrderDraftSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const { orderId, customerId, source, note, items } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_order_draft", {
    p_order_id: orderId,
    p_customer_id: customerId,
    p_source: source,
    p_note: note,
    p_items: toRpcItems(items),
  });
  return toResult(data, error);
}

export async function confirmOrder(input: OrderActionInput): Promise<ActionResult<OrderResult>> {
  const auth = await authorize("orders.process");
  if (!auth.ok) return auth;

  const parsed = orderActionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_order", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_order_id: parsed.data.orderId,
  });
  return toResult(data, error);
}

export async function deliverOrder(input: OrderActionInput): Promise<ActionResult<OrderResult>> {
  const auth = await authorize("orders.process");
  if (!auth.ok) return auth;

  const parsed = orderActionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deliver_order", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_order_id: parsed.data.orderId,
  });
  return toResult(data, error);
}

export async function cancelOrder(input: CancelOrderInput): Promise<ActionResult<OrderResult>> {
  const auth = await authorize("orders.process");
  if (!auth.ok) return auth;

  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_order", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });
  return toResult(data, error);
}

export async function assignOrder(input: AssignOrderInput): Promise<ActionResult<OrderResult>> {
  const auth = await authorize("orders.assign");
  if (!auth.ok) return auth;

  const parsed = assignOrderSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("assign_order", {
    p_order_id: parsed.data.orderId,
    p_user_id: parsed.data.userId,
  });
  return toResult(data, error);
}
