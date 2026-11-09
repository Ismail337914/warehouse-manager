"use server";

import { customerInputSchema, recordId, type CustomerInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/server/auth";
import { dbErrorMessage } from "@/server/db-errors";
import { invalidInput, type ActionResult } from "@/server/result";

function toCustomerRow(input: CustomerInput) {
  const isCompany = input.customerType === "pravno";
  return {
    customer_type: input.customerType,
    name: input.name,
    // A natural person has no JIB or PDV number.
    jib: isCompany ? input.jib || null : null,
    pdv_number: isCompany ? input.pdvNumber || null : null,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    city: input.city || null,
    notes: input.notes,
  };
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function createCustomer(input: CustomerInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("customers.create");
  if (!auth.ok) return auth;

  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.from("customers").insert(toCustomerRow(parsed.data)).select("id").single();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, data };
}

export async function findPotentialCustomerDuplicates(
  input: CustomerInput,
  excludeCustomerId?: string,
): Promise<ActionResult<{ names: string[] }>> {
  const auth = await authorize("customers.read");
  if (!auth.ok) return auth;

  if (excludeCustomerId !== undefined && !recordId.safeParse(excludeCustomerId).success) {
    return { ok: false, error: "Kupac ne postoji." };
  }
  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const email = parsed.data.email.trim();
  const phone = parsed.data.phone.trim();
  if (!email && !phone) return { ok: true, data: { names: [] } };

  const supabase = await createClient();
  const findEmail = () => {
    let query = supabase.from("customers").select("id, name").ilike("email", escapeLikePattern(email));
    if (excludeCustomerId) query = query.neq("id", excludeCustomerId);
    return query.limit(6);
  };
  const findPhone = () => {
    let query = supabase.from("customers").select("id, name").eq("phone", phone);
    if (excludeCustomerId) query = query.neq("id", excludeCustomerId);
    return query.limit(6);
  };
  const [emailMatches, phoneMatches] = await Promise.all([
    email ? findEmail() : Promise.resolve({ data: [], error: null }),
    phone ? findPhone() : Promise.resolve({ data: [], error: null }),
  ]);
  if (emailMatches.error || phoneMatches.error) return { ok: false, error: "Mogući duplikati nisu provjereni." };

  const uniqueNames = new Map<string, string>();
  for (const customer of [...emailMatches.data, ...phoneMatches.data]) uniqueNames.set(customer.id, customer.name);
  return { ok: true, data: { names: [...uniqueNames.values()] } };
}

export async function updateCustomer(customerId: string, input: CustomerInput): Promise<ActionResult<{ id: string }>> {
  const auth = await authorize("customers.update");
  if (!auth.ok) return auth;

  if (!recordId.safeParse(customerId).success) return { ok: false, error: "Kupac ne postoji." };
  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update(toCustomerRow(parsed.data))
    .eq("id", customerId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data) return { ok: false, error: "Kupac ne postoji." };
  return { ok: true, data };
}
