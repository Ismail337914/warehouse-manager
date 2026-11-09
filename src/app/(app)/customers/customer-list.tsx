"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Pagination, QueryState, SearchInput } from "@/components/list";
import { CsvExportButton } from "@/components/csv-export-button";
import {
  Badge,
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
import { customerTypeLabels } from "@/lib/labels";
import { fetchCustomers, fetchCustomersForExport } from "@/lib/queries/customers";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useListParams } from "@/lib/use-list-params";

export function CustomerList() {
  const { values, page, update } = useListParams({ q: "", type: "" });
  const params = { ...values, page };
  const customers = useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => fetchCustomers(createClient(), params),
    placeholderData: keepPreviousData,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Kupci</CardTitle>
          <div className="flex flex-wrap gap-2">
            <CsvExportButton
              loadRows={() => fetchCustomersForExport(createClient())}
              fileName="kupci.csv"
              columns={[
                { key: "name", label: "Naziv / ime" },
                { key: "customer_type", label: "Tip kupca" },
                { key: "jib", label: "JIB" },
                { key: "pdv_number", label: "PDV broj" },
                { key: "phone", label: "Telefon" },
                { key: "email", label: "E-mail" },
                { key: "address", label: "Adresa" },
                { key: "city", label: "Mjesto" },
                { key: "notes", label: "Napomene" },
              ]}
            />
            <Button asChild size="sm">
              <Link href="/customers/new">
                <Plus className="h-4 w-4" />
                Novi kupac
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-3 md:flex-row">
          <SearchInput value={values.q} onSearch={(q) => update({ q })} label="Pretraga po nazivu, e-mailu, telefonu ili JIB-u" className="md:w-96" />
          <NativeSelect className="md:w-48" aria-label="Tip kupca" value={values.type} onChange={(event) => update({ type: event.target.value })}>
            <option value="">Svi kupci</option>
            <option value="pravno">Pravna lica</option>
            <option value="fizicko">Fizička lica</option>
          </NativeSelect>
        </div>
      </CardHeader>
      <CardContent>
        <QueryState
          isPending={customers.isPending}
          error={customers.error}
          isEmpty={customers.data?.rows.length === 0}
          emptyText="Nema kupaca za zadane filtere."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naziv</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>JIB / PDV broj</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Mjesto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.data?.rows.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link href={`/customers/${customer.id}`} className="font-medium text-slate-900 hover:underline">
                      {customer.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.customer_type === "pravno" ? "default" : "secondary"}>
                      {customerTypeLabels[customer.customer_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {customer.jib ?? "—"}
                    {customer.pdv_number && <p className="text-xs text-slate-500">PDV {customer.pdv_number}</p>}
                  </TableCell>
                  <TableCell>
                    <p>{customer.phone}</p>
                    <p className="text-xs text-slate-500">{customer.email}</p>
                  </TableCell>
                  <TableCell>{customer.city}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            total={customers.data?.total ?? 0}
            pageSize={customers.data?.pageSize ?? 20}
            onPageChange={(next) => update({ page: next })}
          />
        </QueryState>
      </CardContent>
    </Card>
  );
}
