"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { Button, FormMessage, Input, Label, NativeSelect, Textarea } from "@/components/ui";
import { invalidates } from "@/lib/query-keys";
import { customerInputSchema, type CustomerInput } from "@/lib/schemas";
import { applyFieldErrors, useAction } from "@/lib/use-action";
import { createCustomer, findPotentialCustomerDuplicates, updateCustomer } from "@/server/actions/customers";

const emptyCustomer: CustomerInput = {
  customerType: "fizicko",
  name: "",
  jib: "",
  pdvNumber: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  notes: "",
};

export function CustomerForm({
  customerId,
  defaultValues = emptyCustomer,
  readOnly = false,
}: {
  customerId?: string;
  defaultValues?: CustomerInput;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ key: string; names: string[] } | null>(null);
  const [duplicateOverrideKey, setDuplicateOverrideKey] = useState("");
  const save = useAction(
    (values: CustomerInput) => (customerId ? updateCustomer(customerId, values) : createCustomer(values)),
    invalidates.customer,
  );
  const checkDuplicates = useAction(
    (values: CustomerInput) => findPotentialCustomerDuplicates(values, customerId),
    [],
  );

  const {
    control,
    register,
    getValues,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<CustomerInput>({ resolver: zodResolver(customerInputSchema), defaultValues });
  const isCompany = useWatch({ control, name: "customerType" }) === "pravno";
  const email = useWatch({ control, name: "email" });
  const phone = useWatch({ control, name: "phone" });
  const duplicateKey = `${email?.trim().toLowerCase() ?? ""}|${phone?.trim() ?? ""}`;
  const possibleDuplicates = duplicateWarning?.key === duplicateKey ? duplicateWarning.names : [];

  const saveCustomer = async (values: CustomerInput) => {
    setError("");
    setSaved(false);
    const result = await save.mutateAsync(values);
    if (!result.ok) {
      setError(result.error);
      applyFieldErrors(setFieldError, result.fieldErrors);
      return;
    }
    if (customerId) setSaved(true);
    else router.push(`/customers/${result.data.id}`);
  };

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    setDuplicateWarning(null);
    if (duplicateOverrideKey !== duplicateKey) {
      const checked = await checkDuplicates.mutateAsync(values);
      if (!checked.ok) {
        setError(checked.error);
        return;
      }
      if (checked.data.names.length > 0) {
        setDuplicateWarning({ key: duplicateKey, names: checked.data.names });
        return;
      }
    }
    await saveCustomer(values);
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <fieldset disabled={readOnly || save.isPending || checkDuplicates.isPending} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <div className="space-y-2">
            <Label htmlFor="customer-type">Tip kupca</Label>
            <NativeSelect id="customer-type" {...register("customerType")}>
              <option value="fizicko">Fizičko lice</option>
              <option value="pravno">Pravno lice</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-name">{isCompany ? "Naziv firme" : "Ime i prezime"}</Label>
            <Input id="customer-name" aria-invalid={Boolean(errors.name)} {...register("name")} />
            <FormMessage className="text-xs">{errors.name?.message}</FormMessage>
          </div>
        </div>
        {isCompany && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer-jib">JIB (13 cifara)</Label>
              <Input id="customer-jib" inputMode="numeric" aria-invalid={Boolean(errors.jib)} {...register("jib")} />
              <FormMessage className="text-xs">{errors.jib?.message}</FormMessage>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-pdv">PDV broj (12 cifara, ako je PDV obveznik)</Label>
              <Input id="customer-pdv" inputMode="numeric" aria-invalid={Boolean(errors.pdvNumber)} {...register("pdvNumber")} />
              <FormMessage className="text-xs">{errors.pdvNumber?.message}</FormMessage>
            </div>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer-phone">Telefon</Label>
            <Input id="customer-phone" type="tel" {...register("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-email">E-mail</Label>
            <Input id="customer-email" type="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
            <FormMessage className="text-xs">{errors.email?.message}</FormMessage>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            <Label htmlFor="customer-address">Adresa</Label>
            <Input id="customer-address" {...register("address")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-city">Mjesto</Label>
            <Input id="customer-city" {...register("city")} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer-notes">Napomena</Label>
          <Textarea id="customer-notes" {...register("notes")} />
        </div>
      </fieldset>
      <FormMessage>{error}</FormMessage>
      {possibleDuplicates.length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">
          <p className="font-medium">Mogući duplikati s istim telefonom ili e-mailom:</p>
          <ul className="list-inside list-disc">
            {possibleDuplicates.map((name) => <li key={name}>{name}</li>)}
          </ul>
          <p>Provjerite postojeće kupce prije nego što nastavite.</p>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => {
              setDuplicateOverrideKey(duplicateKey);
              setDuplicateWarning(null);
              void saveCustomer(getValues());
            }}
          >
            Nastavi i spremi ipak
          </Button>
        </div>
      )}
      {!readOnly && (
        <Button type="submit" disabled={save.isPending || checkDuplicates.isPending}>
          {checkDuplicates.isPending ? "Provjera kupaca..." : save.isPending ? "Spremanje..." : customerId ? "Spremi izmjene" : "Spremi kupca"}
        </Button>
      )}
      {saved && <FormMessage tone="info">Izmjene su spremljene.</FormMessage>}
    </form>
  );
}
