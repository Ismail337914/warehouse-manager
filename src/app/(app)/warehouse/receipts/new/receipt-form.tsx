"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormMessage, Input, Label, NativeSelect } from "@/components/ui";
import { fetchProductCosts, fetchProductOptions, fetchSuppliers } from "@/lib/queries/products";
import { invalidates, queryKeys } from "@/lib/query-keys";
import { receiveStockSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { applyFieldErrors, useAction } from "@/lib/use-action";
import { useIdempotencyKey } from "@/lib/use-idempotency-key";
import { receiveStock } from "@/server/actions/stock";
import { createSupplier } from "@/server/actions/suppliers";

// The form has no key field; the key is added when the form is submitted.
const formSchema = receiveStockSchema.omit({ idempotencyKey: true });
type FormValues = z.infer<typeof formSchema>;

const emptyLine = { productId: "", quantity: 1, unitCost: 0 };

// The page is guarded on the server (RequireAccess, "stock.receive"); receive_stock checks the role again.
export function ReceiptForm() {
  const router = useRouter();
  const idempotency = useIdempotencyKey();
  const [error, setError] = useState("");

  const products = useQuery({ queryKey: queryKeys.products.options, queryFn: () => fetchProductOptions(createClient()) });
  const suppliers = useQuery({ queryKey: queryKeys.suppliers.all, queryFn: () => fetchSuppliers(createClient()) });
  const costs = useQuery({ queryKey: queryKeys.products.costs, queryFn: () => fetchProductCosts(createClient()) });
  const receive = useAction(receiveStock, invalidates.stock);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    setError: setFieldError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { supplierId: "", documentNumber: "", note: "", items: [emptyLine] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // Opened from a product page (?product=ID): choose that product in the first line once the options are
  // rendered, and suggest its purchase price once prices are loaded.
  const preselected = useSearchParams().get("product") ?? "";
  const productsLoaded = products.data !== undefined;
  const preselectedCost = costs.data?.get(preselected);
  const prefilled = useRef({ product: false, cost: false });
  useEffect(() => {
    if (!preselected || !productsLoaded) return;
    if (!prefilled.current.product) {
      prefilled.current.product = true;
      setValue("items.0.productId", preselected);
    }
    if (!prefilled.current.cost && preselectedCost !== undefined && getValues("items.0.productId") === preselected) {
      prefilled.current.cost = true;
      setValue("items.0.unitCost", preselectedCost);
    }
  }, [preselected, productsLoaded, preselectedCost, getValues, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    const result = await receive.mutateAsync({ ...values, idempotencyKey: idempotency.get() });
    if (!result.ok) {
      setError(result.error);
      applyFieldErrors(setFieldError, result.fieldErrors);
      return;
    }
    idempotency.renew();
    // Back to the product the receipt was opened from, so the new stock is visible right away.
    router.push(preselected ? `/warehouse/${encodeURIComponent(preselected)}` : "/warehouse");
  });

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Prijem robe</CardTitle>
        <CardDescription>Povećava stanje i upisuje prijem u historiju kretanja svakog proizvoda.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="receipt-supplier">Dobavljač</Label>
              {/* Controlled, so a supplier added below is shown as soon as the refreshed list contains it. */}
              <Controller
                control={control}
                name="supplierId"
                render={({ field: select }) => (
                  <NativeSelect
                    id="receipt-supplier"
                    name={select.name}
                    ref={select.ref}
                    onBlur={select.onBlur}
                    value={select.value}
                    onChange={(event) => select.onChange(event.target.value)}
                  >
                    <option value="">Bez dobavljača</option>
                    {suppliers.data?.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </NativeSelect>
                )}
              />
              <NewSupplier onCreated={(id) => setValue("supplierId", id, { shouldDirty: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt-document">Broj otpremnice / fakture dobavljača</Label>
              <Input id="receipt-document" {...register("documentNumber")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt-note">Napomena</Label>
              <Input id="receipt-note" {...register("note")} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="hidden grid-cols-[2fr_1fr_1fr_auto] gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
              <span>Proizvod</span>
              <span>Količina</span>
              <span>Nabavna cijena (KM)</span>
              <span />
            </div>
            {fields.map((field, index) => {
              const lineErrors = errors.items?.[index];
              return (
                <div key={field.id} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
                  <div className="space-y-1">
                    <NativeSelect
                      aria-label={`Proizvod, stavka ${index + 1}`}
                      aria-invalid={Boolean(lineErrors?.productId)}
                      {...register(`items.${index}.productId`, {
                        // Suggest the current purchase price for the chosen product.
                        onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                          const cost = costs.data?.get(event.target.value);
                          if (cost !== undefined) setValue(`items.${index}.unitCost`, cost);
                        },
                      })}
                    >
                      <option value="">Odaberite proizvod...</option>
                      {products.data?.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} · {product.name} (stanje {product.quantity})
                        </option>
                      ))}
                    </NativeSelect>
                    <FormMessage className="text-xs">{lineErrors?.productId?.message}</FormMessage>
                  </div>
                  <div className="space-y-1">
                    <Input type="number" min={1} aria-label={`Količina, stavka ${index + 1}`} aria-invalid={Boolean(lineErrors?.quantity)} {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                    <FormMessage className="text-xs">{lineErrors?.quantity?.message}</FormMessage>
                  </div>
                  <div className="space-y-1">
                    <Input type="number" step="0.01" min={0} aria-label={`Nabavna cijena, stavka ${index + 1}`} aria-invalid={Boolean(lineErrors?.unitCost)} {...register(`items.${index}.unitCost`, { valueAsNumber: true })} />
                    <FormMessage className="text-xs">{lineErrors?.unitCost?.message}</FormMessage>
                  </div>
                  <Button type="button" variant="outline" aria-label={`Ukloni stavku ${index + 1}`} disabled={fields.length === 1} onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <FormMessage>{errors.items?.root?.message ?? errors.items?.message}</FormMessage>
            <Button type="button" variant="secondary" onClick={() => append(emptyLine)}>
              Dodaj stavku
            </Button>
          </div>

          <FormMessage>{error}</FormMessage>
          <Button type="submit" disabled={receive.isPending}>
            {receive.isPending ? "Knjiženje..." : "Proknjiži prijem"}
          </Button>
          <p className="text-xs text-slate-500">Nabavne cijene su bez PDV-a.</p>
        </form>
      </CardContent>
    </Card>
  );
}

// Adds a supplier by name without leaving the receipt (no nested <form>: Enter is handled on the input).
// JIB, address and contact can be filled in later under Lager → Dobavljači.
function NewSupplier({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const create = useAction(createSupplier, invalidates.supplier);

  const close = () => {
    setOpen(false);
    setName("");
    setError("");
  };

  const submit = async () => {
    setError("");
    const result = await create.mutateAsync({ name, jib: "", pdvNumber: "", address: "", city: "", phone: "", email: "", note: "" });
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
        + Novi dobavljač
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          aria-label="Naziv novog dobavljača"
          placeholder="Naziv dobavljača"
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
