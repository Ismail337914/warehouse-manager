"use server";

import {
  adjustStockSchema,
  receiveStockSchema,
  stockCountSchema,
  type AdjustStockInput,
  type ReceiveStockInput,
  type StockCountInput,
} from "@/lib/schemas";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/server/auth";
import { dbErrorMessage } from "@/server/db-errors";
import { invalidInput, type ActionResult } from "@/server/result";

export async function receiveStock(input: ReceiveStockInput): Promise<ActionResult<Json>> {
  const auth = await authorize("stock.receive");
  if (!auth.ok) return auth;

  const parsed = receiveStockSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const { idempotencyKey, supplierId, documentNumber, note, items } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_stock", {
    p_idempotency_key: idempotencyKey,
    p_supplier_id: supplierId,
    p_document_number: documentNumber,
    p_note: note,
    p_items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity, unit_cost: item.unitCost })),
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, data };
}

export async function adjustStock(input: AdjustStockInput): Promise<ActionResult<Json>> {
  const auth = await authorize("stock.adjust");
  if (!auth.ok) return auth;

  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_product_id: parsed.data.productId,
    p_quantity_change: parsed.data.quantityChange,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, data };
}

export async function countStock(input: StockCountInput): Promise<ActionResult<Json>> {
  const auth = await authorize("stock.adjust");
  if (!auth.ok) return auth;

  const parsed = stockCountSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stock_count", {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_reason: parsed.data.reason,
    p_items: parsed.data.items.map((item) => ({
      product_id: item.productId,
      counted_quantity: item.countedQuantity,
    })),
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, data };
}
