"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { QueryState } from "@/components/list";
import { useCurrentUser } from "@/components/providers";
import { Button, FormMessage, Input, Label, NativeSelect } from "@/components/ui";
import { maxDiscount } from "@/lib/discount";
import { orderSourceLabels } from "@/lib/labels";
import { documentTotals, lineAmounts } from "@/lib/money";
import { fetchCustomerOptions } from "@/lib/queries/customers";
import { fetchProductOptions, fetchSettings } from "@/lib/queries/products";
import { invalidates, queryKeys } from "@/lib/query-keys";
import { orderDraftSchema, type OrderDraftInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { applyFieldErrors, useAction } from "@/lib/use-action";
import { useIdempotencyKey } from "@/lib/use-idempotency-key";
import { formatMoney } from "@/lib/utils";
import { createOrder, updateOrderDraft } from "@/server/actions/orders";

const emptyLine = { productId: "", quantity: 1, discountPercent: 0 };

const emptyOrder: OrderDraftInput = { customerId: "", source: "telefon", note: "", items: [emptyLine] };

export function OrderForm({ orderId, defaultValues = emptyOrder }: { orderId?: string; defaultValues?: OrderDraftInput }) {
  const router = useRouter();
  const user = useCurrentUser();
  const idempotency = useIdempotencyKey();
  const [error, setError] = useState("");

  const customers = useQuery({ queryKey: queryKeys.customers.options, queryFn: () => fetchCustomerOptions(createClient()) });
  const products = useQuery({ queryKey: queryKeys.products.options, queryFn: () => fetchProductOptions(createClient()) });
  const settings = useQuery({ queryKey: queryKeys.settings.all, queryFn: () => fetchSettings(createClient()) });

  const save = useAction(
    (values: OrderDraftInput) =>
      orderId ? updateOrderDraft({ ...values, orderId }) : createOrder({ ...values, idempotencyKey: idempotency.get() }),
    invalidates.order,
  );

  const {
    control,
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors },
  } = useForm<OrderDraftInput>({ resolver: zodResolver(orderDraftSchema), defaultValues });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });

  const activeProducts = products.data?.filter((product) => product.status === "active") ?? [];
  const productById = new Map(activeProducts.map((product) => [product.id, product]));
  const previewLines = items.flatMap((item) => {
    const product = productById.get(item.productId);
    if (!product || !(item.quantity > 0)) return [];
    return [{ quantity: item.quantity, unitPrice: product.sell_price, discountPercent: item.discountPercent || 0, vatRate: product.vat_rate }];
  });
  const totals = documentTotals(previewLines);
  const limit = maxDiscount(user.role, settings.data);

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    const result = await save.mutateAsync(values);
    if (!result.ok) {
      setError(result.error);
      applyFieldErrors(setFieldError, result.fieldErrors);
      return;
    }
    idempotency.renew();
    router.push(`/orders/${result.data.id}`);
  });

  return (
    <QueryState isPending={customers.isPending || products.isPending} error={customers.error ?? products.error}>
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="order-customer">Kupac</Label>
            <NativeSelect id="order-customer" aria-invalid={Boolean(errors.customerId)} {...register("customerId")}>
              <option value="">Odaberite kupca...</option>
              {customers.data?.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </NativeSelect>
            <FormMessage className="text-xs">{errors.customerId?.message}</FormMessage>
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-source">Izvor</Label>
            <NativeSelect id="order-source" {...register("source")}>
              {Object.entries(orderSourceLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="order-note">Napomena</Label>
            <Input id="order-note" {...register("note")} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="hidden grid-cols-[2.2fr_0.8fr_0.8fr_1fr_auto] gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
            <span>Proizvod</span>
            <span>Količina</span>
            <span>Popust % (do {limit})</span>
            <span className="text-right">Iznos s PDV-om</span>
            <span />
          </div>
          {fields.map((field, index) => {
            const lineErrors = errors.items?.[index];
            const item = items[index];
            const product = item ? productById.get(item.productId) : undefined;
            const amounts =
              product && item.quantity > 0
                ? lineAmounts({ quantity: item.quantity, unitPrice: product.sell_price, discountPercent: item.discountPercent || 0, vatRate: product.vat_rate })
                : null;
            return (
              <div key={field.id} className="grid gap-3 md:grid-cols-[2.2fr_0.8fr_0.8fr_1fr_auto]">
                <div className="space-y-1">
                  <NativeSelect aria-label={`Proizvod, stavka ${index + 1}`} aria-invalid={Boolean(lineErrors?.productId)} {...register(`items.${index}.productId`)}>
                    <option value="">Odaberite proizvod...</option>
                    {activeProducts.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} · {formatMoney(option.sell_price)} · dostupno {option.available_quantity}
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
                  <Input type="number" min={0} max={limit} step="0.01" aria-label={`Popust, stavka ${index + 1}`} aria-invalid={Boolean(lineErrors?.discountPercent)} {...register(`items.${index}.discountPercent`, { valueAsNumber: true })} />
                  <FormMessage className="text-xs">{lineErrors?.discountPercent?.message}</FormMessage>
                </div>
                <p className="self-center text-right text-sm font-medium text-slate-900">{amounts ? formatMoney(amounts.gross) : "—"}</p>
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

        <div className="ml-auto max-w-xs space-y-1 rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Osnovica</span>
            <span>{formatMoney(totals.net)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>PDV</span>
            <span>{formatMoney(totals.vat)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold text-slate-900">
            <span>Ukupno</span>
            <span>{formatMoney(totals.gross)}</span>
          </div>
          <p className="pt-1 text-xs text-slate-500">Pregled; konačne iznose računa baza po važećim cijenama.</p>
        </div>

        <FormMessage>{error}</FormMessage>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Spremanje..." : orderId ? "Spremi nacrt" : "Kreiraj nacrt narudžbe"}
        </Button>
      </form>
    </QueryState>
  );
}
