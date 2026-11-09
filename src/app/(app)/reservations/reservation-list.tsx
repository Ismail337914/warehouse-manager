"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { QueryState } from "@/components/list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { fetchActiveReservations } from "@/lib/queries/orders";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils";

export function ReservationList() {
  const reservations = useQuery({
    queryKey: queryKeys.reservations.all,
    queryFn: () => fetchActiveReservations(createClient()),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivne rezervacije</CardTitle>
        <CardDescription>
          Roba rezervisana potvrđenim narudžbama. Oslobađa se isporukom ili otkazivanjem narudžbe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState
          isPending={reservations.isPending}
          error={reservations.error}
          isEmpty={reservations.data?.length === 0}
          emptyText="Trenutno nema rezervisane robe."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Narudžba</TableHead>
                <TableHead>Kupac</TableHead>
                <TableHead>Proizvod</TableHead>
                <TableHead className="text-right">Količina</TableHead>
                <TableHead>Potvrđena</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.data?.map((reservation) => (
                <TableRow key={`${reservation.order_id}-${reservation.product_id}`}>
                  <TableCell>
                    <Link href={`/orders/${reservation.order_id}`} className="font-medium text-slate-900 hover:underline">
                      {reservation.order_number}
                    </Link>
                  </TableCell>
                  <TableCell>{reservation.customer_name}</TableCell>
                  <TableCell>
                    <Link href={`/warehouse/${reservation.product_id}`} className="hover:underline">
                      {reservation.product_name}
                    </Link>
                    <p className="text-xs text-slate-500">{reservation.sku}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    {reservation.quantity} {reservation.unit}
                  </TableCell>
                  <TableCell>{reservation.confirmed_at && formatDateTime(reservation.confirmed_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueryState>
      </CardContent>
    </Card>
  );
}
