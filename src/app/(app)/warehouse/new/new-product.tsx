"use client";

import { useQuery } from "@tanstack/react-query";

import { QueryState } from "@/components/list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { fetchSettings } from "@/lib/queries/products";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";

import { ProductForm } from "../product-form";

// The page is guarded on the server (RequireAccess, "products.create").
export function NewProduct() {
  // The default VAT rate comes from settings, not from code.
  const settings = useQuery({ queryKey: queryKeys.settings.all, queryFn: () => fetchSettings(createClient()) });

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Novi proizvod</CardTitle>
        <CardDescription>Početno stanje je 0; robu dodajte kroz prijem robe.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState isPending={settings.isPending} error={settings.error}>
          {settings.data && (
            <ProductForm
              defaultValues={{
                sku: "",
                barcode: "",
                oemNumber: "",
                name: "",
                categoryId: Number.NaN,
                description: "",
                buyPrice: 0,
                sellPrice: 0,
                vatRate: settings.data.default_vat_rate,
                minQuantity: 0,
                unit: "kom",
                location: "",
                status: "active",
              }}
            />
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
