"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { QueryState } from "@/components/list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { fetchOrder } from "@/lib/queries/orders";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";

import { OrderForm } from "../../order-form";

export function EditOrder() {
  const { id } = useParams<{ id: string }>();
  const order = useQuery({ queryKey: queryKeys.orders.detail(id), queryFn: () => fetchOrder(createClient(), id) });

  return (
    <div className="space-y-6">
      <Link href={`/orders/${id}`} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Nazad na narudžbu
      </Link>
      <QueryState isPending={order.isPending} error={order.error} isEmpty={!order.data} emptyText="Narudžba ne postoji.">
        {order.data &&
          (order.data.status !== "nacrt" ? (
            <p className="text-sm text-slate-600">Narudžba {order.data.number} više nije nacrt i ne može se mijenjati.</p>
          ) : (
            <Card className="max-w-5xl">
              <CardHeader>
                <CardTitle>Izmjena nacrta {order.data.number}</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderForm
                  orderId={id}
                  defaultValues={{
                    customerId: order.data.customer_id,
                    source: order.data.source,
                    note: order.data.note,
                    items: order.data.items.map((item) => ({
                      productId: item.product_id,
                      quantity: item.quantity,
                      discountPercent: item.discount_percent,
                    })),
                  }}
                />
              </CardContent>
            </Card>
          ))}
      </QueryState>
    </div>
  );
}
