"use server";

import { recordId, supplierInputSchema, type SupplierInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/server/auth";
import { dbErrorMessage } from "@/server/db-errors";
import { invalidInput, type ActionResult } from "@/server/result";

// Empty optional values are stored as null where the column has a format check (JIB, PDV broj, e-mail).
function toSupplierRow(input: SupplierInput) {
  return {
    name: input.name,
    jib: input.jib || null,
    pdv_number: input.pdvNumber || null,
    address: input.address,
    city: input.city,
    phone: input.phone,
    email: input.email || null,
    note: input.note,
  };
}

export async function createSupplier(input: SupplierInput): Promise<ActionResult<{ id: string; name: string }>> {
  const auth = await authorize("suppliers.manage");
  if (!auth.ok) return auth;

  const parsed = supplierInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").insert(toSupplierRow(parsed.data)).select("id, name").single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, data };
}

export async function updateSupplier(supplierId: string, input: SupplierInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("suppliers.manage");
  if (!auth.ok) return auth;

  if (!recordId.safeParse(supplierId).success) return { ok: false, error: "Dobavljač ne postoji." };
  const parsed = supplierInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .update(toSupplierRow(parsed.data))
    .eq("id", supplierId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data) return { ok: false, error: "Dobavljač ne postoji." };
  return { ok: true, data };
}

// A supplier with goods receipts or purchasing documents can't be deleted (ON DELETE RESTRICT in the database).
export async function deleteSupplier(supplierId: string): Promise<ActionResult> {
  const auth = await authorize("suppliers.manage");
  if (!auth.ok) return auth;

  if (!recordId.safeParse(supplierId).success) return { ok: false, error: "Dobavljač ne postoji." };
  const supabase = await createClient();
  // select(): a row hidden by RLS is not an error, just 0 deleted rows.
  const { data, error } = await supabase.from("suppliers").delete().eq("id", supplierId).select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return { ok: false, error: "Dobavljač ne postoji." };
  return { ok: true, data: null };
}
