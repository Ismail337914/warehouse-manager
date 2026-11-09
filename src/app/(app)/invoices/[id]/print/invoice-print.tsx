"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

import { QueryState } from "@/components/list";
import { Button } from "@/components/ui";
import { fetchInvoice } from "@/lib/queries/invoices";
import { fetchSettings } from "@/lib/queries/products";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { usePrintOnLoad } from "@/lib/use-print-on-load";

import { InvoiceDocument } from "../../invoice-document";

// Paper for this page only: A4 with 15 mm margins.
const paperStyle = "@media print { @page { size: A4; margin: 15mm; } }";

// Print view: the app shell and these buttons are hidden by print:hidden, so only the document is printed.
// Opened with ?print=1 (after issuing at the till, or "Štampaj"), the print dialog opens by itself.
export function InvoicePrint() {
  const { id } = useParams<{ id: string }>();
  const invoice = useQuery({ queryKey: queryKeys.invoices.detail(id), queryFn: () => fetchInvoice(createClient(), id) });
  const settings = useQuery({ queryKey: queryKeys.settings.all, queryFn: () => fetchSettings(createClient()) });
  const ready = Boolean(invoice.data && settings.data);
  usePrintOnLoad(ready);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <style>{paperStyle}</style>
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/invoices/${id}`} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Nazad na fakturu
        </Link>
        <Button size="sm" disabled={!ready} onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Štampaj
        </Button>
      </div>
      <QueryState
        isPending={invoice.isPending || settings.isPending}
        error={invoice.error ?? settings.error}
        isEmpty={!invoice.data}
        emptyText="Faktura ne postoji."
      >
        {invoice.data && settings.data && (
          <article className="rounded-xl border border-slate-200 bg-white p-8 print:rounded-none print:border-0 print:p-0">
            <header className="mb-8 flex items-start justify-between gap-4">
              <h1 className="text-2xl font-semibold text-slate-900">
                {invoice.data.storno_of ? "Storno faktura" : "Faktura"} {invoice.data.number}
              </h1>
              {invoice.data.original && <p className="text-sm text-slate-600">Storno fakture {invoice.data.original.number}</p>}
            </header>
            <InvoiceDocument
              invoice={invoice.data}
              contact={{
                city: settings.data.company_city,
                phone: settings.data.company_phone,
                email: settings.data.company_email,
                bankAccount: settings.data.company_bank_account,
                footer: settings.data.receipt_footer,
              }}
            />
          </article>
        )}
      </QueryState>
    </div>
  );
}
