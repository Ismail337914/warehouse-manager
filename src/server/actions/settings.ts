"use server";

import { settingsInputSchema, type SettingsInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/server/auth";
import { dbErrorMessage } from "@/server/db-errors";
import { invalidInput, type ActionResult } from "@/server/result";

export async function updateSettings(input: SettingsInput): Promise<ActionResult> {
  const auth = await authorize("settings.manage");
  if (!auth.ok) return auth;

  const parsed = settingsInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const values = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .update({
      company_name: values.companyName,
      company_address: values.companyAddress,
      company_jib: values.companyJib || null,
      company_pdv_number: values.companyPdvNumber || null,
      company_city: values.companyCity,
      company_phone: values.companyPhone,
      company_email: values.companyEmail,
      company_bank_account: values.companyBankAccount,
      receipt_footer: values.receiptFooter,
      default_vat_rate: values.defaultVatRate,
      max_discount_prodavac: values.maxDiscountProdavac,
      max_discount_menadzer: values.maxDiscountMenadzer,
      invoice_due_days: values.invoiceDueDays,
    })
    .eq("id", true)
    .select("id");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (data.length === 0) return { ok: false, error: "Postavke nisu spremljene." };
  return { ok: true, data: null };
}
