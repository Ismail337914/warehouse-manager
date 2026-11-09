"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormMessage,
  Input,
  Label,
  NativeSelect,
  Textarea,
  type Feedback,
} from "@/components/ui";
import { fetchProductOptions, type ProductOption } from "@/lib/queries/products";
import { invalidates, queryKeys } from "@/lib/query-keys";
import { adjustStockSchema, stockCountSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { applyFieldErrors, useAction } from "@/lib/use-action";
import { useIdempotencyKey } from "@/lib/use-idempotency-key";
import { adjustStock, countStock } from "@/server/actions/stock";

// The page is guarded on the server (RequireAccess, "stock.adjust"); the RPC functions check the role again.
export function StockForms() {
  const products = useQuery({ queryKey: queryKeys.products.options, queryFn: () => fetchProductOptions(createClient()) });

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <AdjustmentForm products={products.data ?? []} />
      <StockCountForm products={products.data ?? []} />
    </div>
  );
}

const adjustmentFormSchema = adjustStockSchema.omit({ idempotencyKey: true });
type AdjustmentValues = z.infer<typeof adjustmentFormSchema>;

function AdjustmentForm({ products }: { products: ProductOption[] }) {
  const idempotency = useIdempotencyKey();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const adjust = useAction(adjustStock, invalidates.stock);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AdjustmentValues>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: { productId: "", quantityChange: Number.NaN, reason: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFeedback(null);
    const result = await adjust.mutateAsync({ ...values, idempotencyKey: idempotency.get() });
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.error });
      applyFieldErrors(setError, result.fieldErrors);
      return;
    }
    idempotency.renew();
    reset();
    setFeedback({ tone: "info", text: "Korekcija je proknjižena." });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Korekcija stanja</CardTitle>
        <CardDescription>Oštećenje, gubitak ili pronađena roba. Razlog je obavezan.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="adjust-product">Proizvod</Label>
            <NativeSelect id="adjust-product" aria-invalid={Boolean(errors.productId)} {...register("productId")}>
              <option value="">Odaberite proizvod...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name} (stanje {product.quantity}, dostupno {product.available_quantity})
                </option>
              ))}
            </NativeSelect>
            <FormMessage className="text-xs">{errors.productId?.message}</FormMessage>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjust-change">Promjena količine (npr. −2 ili 3)</Label>
            <Input id="adjust-change" type="number" aria-invalid={Boolean(errors.quantityChange)} {...register("quantityChange", { valueAsNumber: true })} />
            <FormMessage className="text-xs">{errors.quantityChange?.message}</FormMessage>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjust-reason">Razlog</Label>
            <Textarea id="adjust-reason" aria-invalid={Boolean(errors.reason)} {...register("reason")} />
            <FormMessage className="text-xs">{errors.reason?.message}</FormMessage>
          </div>
          <Button type="submit" disabled={adjust.isPending}>
            {adjust.isPending ? "Knjiženje..." : "Proknjiži korekciju"}
          </Button>
          <FormMessage tone={feedback?.tone}>{feedback?.text}</FormMessage>
        </form>
      </CardContent>
    </Card>
  );
}

const countFormSchema = stockCountSchema.omit({ idempotencyKey: true });
type CountValues = z.infer<typeof countFormSchema>;

function StockCountForm({ products }: { products: ProductOption[] }) {
  const idempotency = useIdempotencyKey();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const count = useAction(countStock, invalidates.stock);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CountValues>({
    resolver: zodResolver(countFormSchema),
    defaultValues: { reason: "", items: [{ productId: "", countedQuantity: Number.NaN }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const onSubmit = handleSubmit(async (values) => {
    setFeedback(null);
    const result = await count.mutateAsync({ ...values, idempotencyKey: idempotency.get() });
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.error });
      applyFieldErrors(setError, result.fieldErrors);
      return;
    }
    idempotency.renew();
    reset();
    setFeedback({ tone: "info", text: "Inventura je proknjižena; razlike su upisane u historiju kretanja." });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventura</CardTitle>
        <CardDescription>Unesite prebrojane količine; knjiže se samo razlike u odnosu na stanje.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          {fields.map((field, index) => {
            const lineErrors = errors.items?.[index];
            return (
              <div key={field.id} className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
                <div className="space-y-1">
                  <NativeSelect aria-label={`Proizvod, red ${index + 1}`} aria-invalid={Boolean(lineErrors?.productId)} {...register(`items.${index}.productId`)}>
                    <option value="">Odaberite proizvod...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} · {product.name} (u sistemu {product.quantity})
                      </option>
                    ))}
                  </NativeSelect>
                  <FormMessage className="text-xs">{lineErrors?.productId?.message}</FormMessage>
                </div>
                <div className="space-y-1">
                  <Input type="number" min={0} placeholder="Prebrojano" aria-label={`Prebrojana količina, red ${index + 1}`} aria-invalid={Boolean(lineErrors?.countedQuantity)} {...register(`items.${index}.countedQuantity`, { valueAsNumber: true })} />
                  <FormMessage className="text-xs">{lineErrors?.countedQuantity?.message}</FormMessage>
                </div>
                <Button type="button" variant="outline" aria-label={`Ukloni red ${index + 1}`} disabled={fields.length === 1} onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button type="button" variant="secondary" onClick={() => append({ productId: "", countedQuantity: Number.NaN })}>
            Dodaj proizvod
          </Button>
          <div className="space-y-2">
            <Label htmlFor="count-reason">Razlog / oznaka inventure</Label>
            <Input id="count-reason" aria-invalid={Boolean(errors.reason)} {...register("reason")} />
            <FormMessage className="text-xs">{errors.reason?.message}</FormMessage>
          </div>
          <Button type="submit" disabled={count.isPending}>
            {count.isPending ? "Knjiženje..." : "Proknjiži inventuru"}
          </Button>
          <FormMessage tone={feedback?.tone}>{feedback?.text}</FormMessage>
        </form>
      </CardContent>
    </Card>
  );
}
