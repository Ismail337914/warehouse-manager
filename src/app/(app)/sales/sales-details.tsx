"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { QueryState } from "@/components/list";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { currentMonthKey, monthRange } from "@/lib/month";
import { fetchSalesDocumentsByMonth } from "@/lib/queries/dashboard";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatMoney } from "@/lib/utils";

const monthFormat = new Intl.DateTimeFormat("hr-HR", { month: "long", year: "numeric", timeZone: "UTC" });

const documentLabels: Record<string, string> = {
  pos_sale: "POS prodaja",
  invoice: "Faktura narudžbe",
  storno: "Storno fakture",
};

export function SalesDetails() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMonth = searchParams.get("month") ?? "";
  const month = monthRange(requestedMonth) ? requestedMonth : currentMonthKey();
  const documents = useQuery({
    queryKey: queryKeys.salesDocuments(month),
    queryFn: () => fetchSalesDocumentsByMonth(createClient(), month),
  });
  const total = documents.data?.reduce((sum, document) => sum + document.amount, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-4">
            <Link href="/">Nazad na pregled</Link>
          </Button>
          <p className="text-sm text-slate-500">Pregled prometa iz POS prodaja i faktura narudžbi</p>
          <h1 className="text-3xl font-semibold capitalize tracking-tight text-slate-900">
            Detalji prodaje — {monthFormat.format(new Date(`${month}-01`))}
          </h1>
        </div>
        <div className="space-y-2">
          <label htmlFor="sales-month" className="block text-sm font-medium text-slate-700">Mjesec</label>
          <Input
            id="sales-month"
            type="month"
            value={month}
            onChange={(event) => {
              if (monthRange(event.target.value)) router.replace(`/sales?month=${event.target.value}`);
            }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Promet: {formatMoney(total)}</CardTitle>
          <p className="text-sm text-slate-500">
            Storno fakture su prikazane kao negativni iznosi. Fakture vezane za POS prodaju nisu uračunate drugi put.
          </p>
        </CardHeader>
        <CardContent>
          <QueryState
            isPending={documents.isPending}
            error={documents.error}
            isEmpty={documents.data?.length === 0}
            emptyText="Za ovaj mjesec nema evidentiranih prodaja."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dokument</TableHead>
                  <TableHead>Broj</TableHead>
                  <TableHead>Kupac</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Izvor</TableHead>
                  <TableHead className="text-right">Iznos s PDV-om</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.data?.map((document) => (
                  <TableRow key={`${document.document_type}-${document.document_id}`}>
                    <TableCell>{documentLabels[document.document_type] ?? document.document_type}</TableCell>
                    <TableCell>
                      <Link
                        href={document.document_type === "pos_sale" ? `/pos/${document.document_id}/print` : `/invoices/${document.document_id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {document.document_number}
                      </Link>
                    </TableCell>
                    <TableCell>{document.customer_name}</TableCell>
                    <TableCell>{formatDate(document.document_date)}</TableCell>
                    <TableCell>
                      {document.source_id ? (
                        <Link href={`/orders/${document.source_id}`} className="text-slate-600 hover:underline">
                          Narudžba {document.source_number}
                        </Link>
                      ) : document.document_type === "pos_sale" ? "POS kasa" : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${document.amount < 0 ? "text-red-700" : ""}`}>
                      {formatMoney(document.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
