"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Pagination, QueryState, SearchInput } from "@/components/list";
import { useCurrentUser } from "@/components/providers";
import { OrderStatusBadge } from "@/components/status-badges";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  NativeSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { orderSourceLabels } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { orderStatusLabels } from "@/lib/order-status";
import { fetchAssignableUsers, fetchOrders } from "@/lib/queries/orders";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useListParams } from "@/lib/use-list-params";
import { formatDate, formatMoney } from "@/lib/utils";

export function OrderList() {
  const user = useCurrentUser();
  // Staff see every order and who works on it; a seller sees only their own orders (RLS), so no column.
  const showSeller = can(user.role, "orders.read_all");
  const { values, page, update } = useListParams({ q: "", status: "" });
  const params = { ...values, page };
  const orders = useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => fetchOrders(createClient(), params),
    placeholderData: keepPreviousData,
  });
  const users = useQuery({
    queryKey: queryKeys.users.assignable,
    queryFn: () => fetchAssignableUsers(createClient()),
    enabled: showSeller,
  });
  const sellerName = (id: string | null) => {
    const seller = users.data?.find((option) => option.id === id);
    return seller ? seller.full_name || seller.email : "—";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>{showSeller ? "Narudžbe" : "Moje narudžbe"}</CardTitle>
          <Button asChild size="sm">
            <Link href="/orders/new">
              <Plus className="h-4 w-4" />
              Nova narudžba
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-2 pt-3 md:flex-row">
          <SearchInput value={values.q} onSearch={(q) => update({ q })} label="Pretraga po broju ili kupcu" className="md:w-80" />
          <NativeSelect className="md:w-48" aria-label="Status" value={values.status} onChange={(event) => update({ status: event.target.value })}>
            <option value="">Svi statusi</option>
            {Object.entries(orderStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          isPending={orders.isPending}
          error={orders.error}
          isEmpty={orders.data?.rows.length === 0}
          emptyText="Nema narudžbi za zadane filtere."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broj</TableHead>
                <TableHead>Kupac</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Izvor</TableHead>
                {showSeller && <TableHead>Prodavač</TableHead>}
                <TableHead className="text-right">Stavki</TableHead>
                <TableHead className="text-right">Ukupno s PDV-om</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.data?.rows.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link href={`/orders/${order.id}`} className="font-medium text-slate-900 hover:underline">
                      {order.number}
                    </Link>
                  </TableCell>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell>{order.created_at && formatDate(order.created_at)}</TableCell>
                  <TableCell>{order.source && orderSourceLabels[order.source]}</TableCell>
                  {showSeller && <TableCell>{sellerName(order.assigned_to)}</TableCell>}
                  <TableCell className="text-right">{order.item_count}</TableCell>
                  <TableCell className="text-right">{formatMoney(order.total ?? 0)}</TableCell>
                  <TableCell>{order.status && <OrderStatusBadge status={order.status} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            total={orders.data?.total ?? 0}
            pageSize={orders.data?.pageSize ?? 20}
            onPageChange={(next) => update({ page: next })}
          />
        </QueryState>
      </CardContent>
    </Card>
  );
}
