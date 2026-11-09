"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { QueryState } from "@/components/list";
import { useCurrentUser } from "@/components/providers";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormMessage, Input, Label, Textarea } from "@/components/ui";
import { can } from "@/lib/permissions";
import { fetchSettings } from "@/lib/queries/products";
import { invalidates, queryKeys } from "@/lib/query-keys";
import { settingsInputSchema, type SettingsInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { applyFieldErrors, useAction } from "@/lib/use-action";
import { updateSettings } from "@/server/actions/settings";

type Settings = Awaited<ReturnType<typeof fetchSettings>>;

const toFormValues = (settings: Settings): SettingsInput => ({
  companyName: settings.company_name,
  companyAddress: settings.company_address,
  companyJib: settings.company_jib ?? "",
  companyPdvNumber: settings.company_pdv_number ?? "",
  companyCity: settings.company_city,
  companyPhone: settings.company_phone,
  companyEmail: settings.company_email,
  companyBankAccount: settings.company_bank_account,
  receiptFooter: settings.receipt_footer,
  defaultVatRate: settings.default_vat_rate,
  maxDiscountProdavac: settings.max_discount_prodavac,
  maxDiscountMenadzer: settings.max_discount_menadzer,
  invoiceDueDays: settings.invoice_due_days,
});

// Company details (printed on receipts and invoices), VAT rate, discount limits and payment terms.
// Admins edit them; managers see them read-only. updateSettings and RLS check the role again.
export function CompanySettings() {
  const settings = useQuery({ queryKey: queryKeys.settings.all, queryFn: () => fetchSettings(createClient()) });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Firma i dokumenti</CardTitle>
        <CardDescription>Podaci koji se štampaju na računima i fakturama, PDV, limiti popusta i rok plaćanja.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState isPending={settings.isPending} error={settings.error}>
          {settings.data && <CompanySettingsForm defaultValues={toFormValues(settings.data)} />}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function CompanySettingsForm({ defaultValues }: { defaultValues: SettingsInput }) {
  const user = useCurrentUser();
  const readOnly = !can(user.role, "settings.manage");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const save = useAction(updateSettings, invalidates.settings);

  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<SettingsInput>({ resolver: zodResolver(settingsInputSchema), defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    setSaved(false);
    const result = await save.mutateAsync(values);
    if (!result.ok) {
      setError(result.error);
      applyFieldErrors(setFieldError, result.fieldErrors);
      return;
    }
    setSaved(true);
  });

  const field = (name: keyof SettingsInput, label: string, input: React.ReactNode) => (
    <div className="space-y-2">
      <Label htmlFor={`settings-${name}`}>{label}</Label>
      {input}
      <FormMessage className="text-xs">{errors[name]?.message}</FormMessage>
    </div>
  );
  const text = (name: keyof SettingsInput, label: string, type = "text") =>
    field(name, label, <Input id={`settings-${name}`} type={type} aria-invalid={Boolean(errors[name])} {...register(name)} />);
  const number = (name: keyof SettingsInput, label: string, step = "0.01") =>
    field(
      name,
      label,
      <Input id={`settings-${name}`} type="number" step={step} aria-invalid={Boolean(errors[name])} {...register(name, { valueAsNumber: true })} />,
    );

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <fieldset disabled={readOnly || save.isPending} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {text("companyName", "Naziv firme")}
          {text("companyAddress", "Adresa")}
          {text("companyCity", "Grad")}
          {text("companyPhone", "Telefon", "tel")}
          {text("companyEmail", "E-mail", "email")}
          {text("companyBankAccount", "Žiro račun")}
          {text("companyJib", "JIB (13 cifara)")}
          {text("companyPdvNumber", "PDV broj (12 cifara)")}
        </div>
        {field(
          "receiptFooter",
          "Poruka na dnu računa",
          <Textarea id="settings-receiptFooter" placeholder="npr. Hvala na kupovini!" aria-invalid={Boolean(errors.receiptFooter)} {...register("receiptFooter")} />,
        )}
        <div className="grid gap-4 md:grid-cols-4">
          {number("defaultVatRate", "PDV (%)")}
          {number("maxDiscountProdavac", "Najveći popust prodavača (%)")}
          {number("maxDiscountMenadzer", "Najveći popust menadžera (%)")}
          {number("invoiceDueDays", "Rok plaćanja (dana)", "1")}
        </div>
      </fieldset>
      <FormMessage>{error}</FormMessage>
      {saved && <FormMessage tone="info">Postavke su spremljene.</FormMessage>}
      {readOnly ? (
        <p className="text-xs text-slate-500">Postavke mijenja samo admin.</p>
      ) : (
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Spremanje..." : "Spremi postavke"}
        </Button>
      )}
    </form>
  );
}
