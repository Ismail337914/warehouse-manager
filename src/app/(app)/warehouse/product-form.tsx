"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

import { Button, FormMessage, Input, Label, NativeSelect, Textarea } from "@/components/ui";
import { productInputSchema, type ProductInput } from "@/lib/schemas";
import { fetchCategories } from "@/lib/queries/products";
import { invalidates, queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { applyFieldErrors, useAction } from "@/lib/use-action";
import { createCategory, createProduct, updateProduct } from "@/server/actions/products";

export function ProductForm({
  productId,
  defaultValues,
  readOnly = false,
  showCost = true,
}: {
  productId?: string;
  defaultValues: ProductInput;
  readOnly?: boolean;
  // The purchase price is shown only to roles that may see it (sellers never receive it from the database).
  showCost?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const categories = useQuery({ queryKey: queryKeys.categories.all, queryFn: () => fetchCategories(createClient()) });
  const save = useAction(
    (values: ProductInput) => (productId ? updateProduct(productId, values) : createProduct(values)),
    invalidates.product,
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError: setFieldError,
    formState: { errors },
  } = useForm<ProductInput>({ resolver: zodResolver(productInputSchema), defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    const result = await save.mutateAsync(values);
    if (!result.ok) {
      setError(result.error);
      applyFieldErrors(setFieldError, result.fieldErrors);
      return;
    }
    if (!productId) router.push(`/warehouse/${result.data.id}`);
    else setError("");
  });

  const field = (name: keyof ProductInput, label: string, input: React.ReactNode) => (
    <div className="space-y-2">
      <Label htmlFor={`product-${name}`}>{label}</Label>
      {input}
      <FormMessage className="text-xs">{errors[name]?.message}</FormMessage>
    </div>
  );
  const numeric = { valueAsNumber: true } as const;

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <fieldset disabled={readOnly || save.isPending} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {field("sku", "Šifra", <Input id="product-sku" aria-invalid={Boolean(errors.sku)} {...register("sku")} />)}
          {field("barcode", "Barkod", <Input id="product-barcode" aria-invalid={Boolean(errors.barcode)} {...register("barcode")} />)}
        </div>
        {field("oemNumber", "OEM / kataloški broj", <Input id="product-oemNumber" aria-invalid={Boolean(errors.oemNumber)} {...register("oemNumber")} />)}
        {field("name", "Naziv", <Input id="product-name" aria-invalid={Boolean(errors.name)} {...register("name")} />)}
        <div className="grid gap-4 md:grid-cols-3">
          {field(
            "categoryId",
            "Kategorija",
            <>
              {/* Controlled, so a category added below is shown as soon as the refreshed list contains it. */}
              <Controller
                control={control}
                name="categoryId"
                render={({ field: select }) => (
                  <NativeSelect
                    id="product-categoryId"
                    aria-invalid={Boolean(errors.categoryId)}
                    name={select.name}
                    ref={select.ref}
                    onBlur={select.onBlur}
                    value={Number.isNaN(select.value) ? "" : String(select.value)}
                    onChange={(event) => select.onChange(event.target.value === "" ? Number.NaN : Number(event.target.value))}
                  >
                    <option value="">{categories.data?.length === 0 ? "Nema kategorija, dodajte novu" : "Odaberite..."}</option>
                    {categories.data?.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </NativeSelect>
                )}
              />
              {!readOnly && (
                <NewCategory onCreated={(id) => setValue("categoryId", id, { shouldDirty: true, shouldValidate: true })} />
              )}
            </>,
          )}
          {field("unit", "Jedinica mjere", <Input id="product-unit" aria-invalid={Boolean(errors.unit)} {...register("unit")} />)}
          {field("location", "Lokacija", <Input id="product-location" aria-invalid={Boolean(errors.location)} {...register("location")} />)}
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {showCost &&
            field("buyPrice", "Nabavna cijena (KM, bez PDV-a)", <Input id="product-buyPrice" type="number" step="0.01" aria-invalid={Boolean(errors.buyPrice)} {...register("buyPrice", numeric)} />)}
          {field("sellPrice", "Prodajna cijena (KM, bez PDV-a)", <Input id="product-sellPrice" type="number" step="0.01" aria-invalid={Boolean(errors.sellPrice)} {...register("sellPrice", numeric)} />)}
          {field("vatRate", "PDV (%)", <Input id="product-vatRate" type="number" step="0.01" aria-invalid={Boolean(errors.vatRate)} {...register("vatRate", numeric)} />)}
          {field("minQuantity", "Minimalna zaliha (upozorenje)", <Input id="product-minQuantity" type="number" aria-invalid={Boolean(errors.minQuantity)} {...register("minQuantity", numeric)} />)}
        </div>
        <p className="-mt-2 text-xs text-slate-500">
          Minimalna zaliha nije stanje: kad stanje padne ispod nje, proizvod se označi kao „niska zaliha“. Stanje se
          mijenja samo kroz prijem robe, korekciju i inventuru.
        </p>
        {field("description", "Opis", <Textarea id="product-description" {...register("description")} />)}
        {field(
          "status",
          "Status",
          <NativeSelect id="product-status" className="md:w-56" {...register("status")}>
            <option value="active">Aktivan</option>
            <option value="inactive">Neaktivan (ne prodaje se)</option>
          </NativeSelect>,
        )}
      </fieldset>
      <FormMessage>{error}</FormMessage>
      {!readOnly && (
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Spremanje..." : productId ? "Spremi izmjene" : "Kreiraj proizvod"}
        </Button>
      )}
      {productId && save.isSuccess && save.data.ok && <FormMessage tone="info">Izmjene su spremljene.</FormMessage>}
    </form>
  );
}

// Adds a category without leaving the product form (no nested <form>: Enter is handled on the input).
// Only admins and managers see the product form in edit mode; the server action and RLS check the role again.
function NewCategory({ onCreated }: { onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const create = useAction(createCategory, invalidates.category);

  const close = () => {
    setOpen(false);
    setName("");
    setError("");
  };

  const submit = async () => {
    setError("");
    const result = await create.mutateAsync({ name });
    if (!result.ok) {
      setError(result.fieldErrors?.name ?? result.error);
      return;
    }
    onCreated(result.data.id);
    close();
  };

  if (!open) {
    return (
      <button type="button" className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline" onClick={() => setOpen(true)}>
        + Nova kategorija
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          aria-label="Naziv nove kategorije"
          placeholder="Naziv kategorije"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!create.isPending) void submit();
            }
            if (event.key === "Escape") close();
          }}
        />
        <Button type="button" size="sm" disabled={create.isPending} onClick={() => void submit()}>
          {create.isPending ? "..." : "Dodaj"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={create.isPending} onClick={close}>
          Odustani
        </Button>
      </div>
      <FormMessage className="text-xs">{error}</FormMessage>
    </div>
  );
}
