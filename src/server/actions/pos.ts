"use server";

import { z } from "zod";

import { posSaleSchema, type PosSaleInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/server/auth";
import { dbErrorMessage } from "@/server/db-errors";
import { invalidInput, type ActionResult } from "@/server/result";

// Shape returned by public.complete_pos_sale.
const posSaleResultSchema = z.object({
  id: z.string(),
  number: z.string(),
  subtotal: z.number(),
  vat_total: z.number(),
  total: z.number(),
});

export type PosSaleResult = z.infer<typeof posSaleResultSchema>;

export async function completePosSale(input: PosSaleInput): Promise<ActionResult<PosSaleResult>> {
  const auth = await authorize("sales.create");
  if (!auth.ok) return auth;

  const parsed = posSaleSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const { idempotencyKey, customerId, paymentMethod, discountPercent, items } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_pos_sale", {
    p_idempotency_key: idempotencyKey,
    p_customer_id: customerId,
    p_payment_method: paymentMethod,
    p_discount_percent: discountPercent,
    p_items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  const result = posSaleResultSchema.safeParse(data);
  if (!result.success) return { ok: false, error: "Neočekivan odgovor baze." };
  return { ok: true, data: result.data };
}
