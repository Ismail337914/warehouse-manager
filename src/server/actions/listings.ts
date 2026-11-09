"use server";

import { listingInputSchema, listingStatusSchema } from "@/lib/schemas/listings";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/server/auth";
import { dbErrorMessage } from "@/server/db-errors";
import { invalidInput, type ActionResult } from "@/server/result";

export async function createListing(input: unknown): Promise<ActionResult<{ id: number }>> {
  const auth = await authorize("ads.manage");
  if (!auth.ok) return auth;

  const parsed = listingInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .insert({
      product_id: parsed.data.productId,
      channel: parsed.data.channel,
      external_id: parsed.data.externalId,
      url: parsed.data.url,
      price: parsed.data.price,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, data };
}

export async function updateListingStatus(listingId: number, status: string): Promise<ActionResult> {
  const auth = await authorize("ads.manage");
  if (!auth.ok) return auth;

  if (!Number.isSafeInteger(listingId) || listingId < 1) return { ok: false, error: "Oglas ne postoji." };
  const parsed = listingStatusSchema.safeParse(status);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .update({ status: parsed.data })
    .eq("id", listingId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data) return { ok: false, error: "Oglas ne postoji." };
  return { ok: true, data: null };
}
