"use server";

import {
  categoryInputSchema,
  numericId,
  productInputSchema,
  recordId,
  type CategoryInput,
  type ProductInput,
} from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/server/auth";
import { dbErrorMessage } from "@/server/db-errors";
import { invalidInput, type ActionResult } from "@/server/result";

// Stock columns are not part of the row: the database grants no write access to them.
function toProductRow(input: ProductInput) {
  return {
    sku: input.sku,
    barcode: input.barcode || null,
    oem_number: input.oemNumber || null,
    name: input.name,
    category_id: input.categoryId,
    description: input.description,
    buy_price: input.buyPrice,
    sell_price: input.sellPrice,
    vat_rate: input.vatRate,
    min_quantity: input.minQuantity,
    unit: input.unit,
    location: input.location,
    status: input.status,
  };
}

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("products.create");
  if (!auth.ok) return auth;

  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").insert(toProductRow(parsed.data)).select("id").single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, data };
}

export async function updateProduct(productId: string, input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("products.update");
  if (!auth.ok) return auth;

  if (!recordId.safeParse(productId).success) return { ok: false, error: "Proizvod ne postoji." };
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update(toProductRow(parsed.data))
    .eq("id", productId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data) return { ok: false, error: "Proizvod ne postoji." };
  return { ok: true, data };
}

export async function createCategory(input: CategoryInput): Promise<ActionResult<{ id: number }>> {
  const auth = await authorize("categories.manage");
  if (!auth.ok) return auth;

  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").insert(parsed.data).select("id").single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, data };
}

export async function updateCategory(categoryId: number, input: CategoryInput): Promise<ActionResult<{ id: number }>> {
  const auth = await authorize("categories.manage");
  if (!auth.ok) return auth;

  if (!numericId.safeParse(categoryId).success) return { ok: false, error: "Kategorija ne postoji." };
  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").update(parsed.data).eq("id", categoryId).select("id").maybeSingle();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data) return { ok: false, error: "Kategorija ne postoji." };
  return { ok: true, data };
}

// A category that still has products can't be deleted: the products' foreign key (ON DELETE RESTRICT) refuses it.
export async function deleteCategory(categoryId: number): Promise<ActionResult> {
  const auth = await authorize("categories.manage");
  if (!auth.ok) return auth;

  if (!numericId.safeParse(categoryId).success) return { ok: false, error: "Kategorija ne postoji." };
  const supabase = await createClient();
  // select(): a row hidden by RLS is not an error, just 0 deleted rows.
  const { data, error } = await supabase.from("categories").delete().eq("id", categoryId).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return { ok: false, error: "Kategorija ne postoji." };
  return { ok: true, data: null };
}
