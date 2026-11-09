"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

import { QueryState } from "@/components/list";
import { Button } from "@/components/ui";
import { paymentMethodLabels } from "@/lib/labels";
import { lineAmounts } from "@/lib/money";
import { fetchSettings } from "@/lib/queries/products";
import { fetchPosSale, type PosSaleReceipt } from "@/lib/queries/pos";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { usePrintOnLoad } from "@/lib/use-print-on-load";
import { formatDateTime, formatMoney } from "@/lib/utils";

type Settings = Awaited<ReturnType<typeof fetchSettings>>;

// Paper for this page only: an 80 mm thermal roll, as long as the receipt.
const paperStyle = "@media print { @page { size: 80mm auto; margin: 3mm; } }";

// POS receipt for an 80 mm till printer. The app shell and the buttons are hidden by print:hidden.
// Opened with ?print=1 right after a sale, the print dialog opens by itself.
export function ReceiptPrint() {
  const { id } = useParams<{ id: string }>();
  const sale = useQuery({ queryKey: queryKeys.posSales.detail(id), queryFn: () => fetchPosSale(createClient(), id) });
  const settings = useQuery({ queryKey: queryKeys.settings.all, queryFn: () => fetchSettings(createClient()) });
  const ready = Boolean(sale.data && settings.data);
  usePrintOnLoad(ready);

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <style>{paperStyle}</style>
      <div className="flex items-center justify-between print:hidden">
        <Link href="/pos" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Nazad na kasu
        </Link>
        <Button size="sm" disabled={!ready} onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Štampaj
        </Button>
      </div>
      <QueryState
        isPending={sale.isPending || settings.isPending}
        error={sale.error ?? settings.error}
        isEmpty={!sale.data}
        emptyText="Račun ne postoji."
      >
        {sale.data && settings.data && <Receipt sale={sale.data} company={settings.data} />}
      </QueryState>
    </div>
  );
}

function Receipt({ sale, company }: { sale: PosSaleReceipt; company: Settings }) {
  const place = [company.company_address, company.company_city].filter(Boolean).join(", ");
  const ids = [company.company_jib && `JIB ${company.company_jib}`, company.company_pdv_number && `PDV ${company.company_pdv_number}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="mx-auto w-[80mm] max-w-full space-y-3 border border-slate-200 bg-white p-4 font-mono text-[12px] leading-snug text-black print:w-full print:border-0 print:p-0">
      <header className="space-y-0.5 text-center">
        <p className="text-sm font-bold">{company.company_name}</p>
        {place && <p>{place}</p>}
        {ids && <p>{ids}</p>}
        {company.company_phone && <p>Tel. {company.company_phone}</p>}
      </header>

      <div className="border-y border-dashed border-black py-2">
        <p className="font-bold">Račun {sale.number}</p>
        <p>{formatDateTime(sale.created_at)}</p>
        {sale.customer && (
          <p>
            Kupac: {sale.customer.name}
            {sale.customer.jib && `, JIB ${sale.customer.jib}`}
          </p>
        )}
      </div>

      <ul className="space-y-1.5">
        {sale.items.map((item) => (
          <li key={item.product_id}>
            <p>{item.product?.name ?? item.product_id}</p>
            <div className="flex justify-between gap-2">
              <span>
                {item.quantity} {item.product?.unit} × {formatMoney(lineAmounts({ quantity: 1, unitPrice: item.unit_price, vatRate: item.vat_rate }).gross)}
                {item.discount_percent > 0 && ` −${item.discount_percent} %`}
              </span>
              <span>{formatMoney(item.gross_amount)}</span>
            </div>
          </li>
        ))}
      </ul>

      {/* Totals as stored by complete_pos_sale; nothing is recalculated here. */}
      <div className="space-y-0.5 border-t border-dashed border-black pt-2">
        <div className="flex justify-between">
          <span>Osnovica</span>
          <span>{formatMoney(sale.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>PDV</span>
          <span>{formatMoney(sale.vat_total)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold">
          <span>UKUPNO</span>
          <span>{formatMoney(sale.total)}</span>
        </div>
        <p>Plaćeno: {paymentMethodLabels[sale.payment_method]}</p>
      </div>

      <footer className="space-y-1 border-t border-dashed border-black pt-2 text-center">
        {company.receipt_footer && <p className="whitespace-pre-line">{company.receipt_footer}</p>}
        <p>DEMO DOKUMENT — NIJE FISKALNI NI ZAKONSKI VALIDAN RAČUN.</p>
      </footer>
    </article>
  );
}
