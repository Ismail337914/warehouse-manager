"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Pagination, QueryState, SearchInput } from "@/components/list";
import { InvoiceStatusBadge } from "@/components/status-badges";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  NativeSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { invoiceStatusLabels } from "@/lib/labels";
import { fetchInvoices } from "@/lib/queries/invoices";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useListParams } from "@/lib/use-list-params";
import { formatDate, formatMoney } from "@/lib/utils";

export function InvoiceList() {
  const { values, page, update } = useListParams({ q: "", status: "", month: "" });
  const params = { ...values, page };
  const invoices = useQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: () => fetchInvoices(createClient(), params),
    placeholderData: keepPreviousData,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fakture</CardTitle>
        <div className="flex flex-col gap-2 pt-3 xl:flex-row">
          <SearchInput value={values.q} onSearch={(q) => update({ q })} label="Pretraga po broju ili kupcu" className="md:w-80" />
          <NativeSelect className="md:w-56" aria-label="Status" value={values.status} onChange={(event) => update({ status: event.target.value })}>
            <option value="">Sve fakture</option>
            <option value="dospjele">Dospjele (neplaćene)</option>
            {Object.entries(invoiceStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
            <option value="storno">Storno dokumenti</option>
          </NativeSelect>
          <Input
            className="md:w-44"
            type="month"
            aria-label="Mjesec fakture"
            value={values.month}
            onChange={(event) => update({ month: event.target.value })}
          />
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          isPending={invoices.isPending}
          error={invoices.error}
          isEmpty={invoices.data?.rows.length === 0}
          emptyText="Nema faktura za zadane filtere. Fakture se izdaju iz isporučenih narudžbi i POS prodaja."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broj</TableHead>
                <TableHead>Kupac</TableHead>
                <TableHead>Izvor</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Dospijeće</TableHead>
                <TableHead className="text-right">Ukupno</TableHead>
                <TableHead className="text-right">Dug</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.data?.rows.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Link href={`/invoices/${invoice.id}`} className="font-medium text-slate-900 hover:underline">
                      {invoice.number}
                    </Link>
                  </TableCell>
                  <TableCell>{invoice.customer_name}</TableCell>
                  <TableCell className="text-slate-500">
                    {invoice.order_number ? `Narudžba ${invoice.order_number}` : `POS ${invoice.pos_sale_number}`}
                  </TableCell>
                  <TableCell>{invoice.issue_date && formatDate(invoice.issue_date)}</TableCell>
                  <TableCell>{invoice.due_date && formatDate(invoice.due_date)}</TableCell>
                  <TableCell className="text-right">{formatMoney(invoice.total ?? 0)}</TableCell>
                  <TableCell className="text-right">{invoice.balance ? formatMoney(invoice.balance) : "—"}</TableCell>
                  <TableCell>
                    {invoice.status && (
                      <InvoiceStatusBadge
                        status={invoice.status}
                        isStorno={Boolean(invoice.storno_of)}
                        isOverdue={invoice.is_overdue ?? false}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            total={invoices.data?.total ?? 0}
            pageSize={invoices.data?.pageSize ?? 20}
            onPageChange={(next) => update({ page: next })}
          />
        </QueryState>
      </CardContent>
    </Card>
  );
}
