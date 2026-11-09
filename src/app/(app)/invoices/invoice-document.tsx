import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { customerTypeLabels, paymentMethodLabels } from "@/lib/labels";
import type { InvoiceDetail } from "@/lib/queries/invoices";
import { formatDate, formatMoney } from "@/lib/utils";

// Contact details from the current settings (not part of the invoice snapshot), shown on the print page.
export type InvoiceContact = {
  city: string;
  phone: string;
  email: string;
  bankAccount: string;
  footer: string;
};

// The invoice as a document: seller, buyer, lines and totals from the snapshot taken at issue.
// Used on the detail page and on the print page (which also passes the company's contact details).
export function InvoiceDocument({ invoice, contact }: { invoice: InvoiceDetail; contact?: InvoiceContact }) {
  const isStorno = Boolean(invoice.storno_of);
  const showBankAccount = Boolean(contact?.bankAccount) && !isStorno && invoice.balance > 0;

  return (
    <div className="space-y-6">
      <p className="border border-dashed border-red-300 bg-red-50 px-4 py-2 text-center text-sm font-semibold tracking-wide text-red-800 print:border-red-700 print:bg-white print:text-black">
        DEMO DOKUMENT — NIJE FISKALNI NI ZAKONSKI VALIDAN RAČUN
      </p>
      <div className="grid gap-4 text-sm md:grid-cols-2 print:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4 print:border-slate-400">
          <p className="text-xs uppercase tracking-wide text-slate-500">Prodavac</p>
          <p className="mt-1 font-medium text-slate-900">{invoice.company_name}</p>
          {(invoice.company_address || contact?.city) && (
            <p className="text-slate-600">{[invoice.company_address, contact?.city].filter(Boolean).join(", ")}</p>
          )}
          <p className="text-slate-600">
            {[invoice.company_jib && `JIB ${invoice.company_jib}`, invoice.company_pdv_number && `PDV ${invoice.company_pdv_number}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {contact && (contact.phone || contact.email) && (
            <p className="text-slate-600">
              {[contact.phone && `Tel. ${contact.phone}`, contact.email].filter(Boolean).join(" · ")}
            </p>
          )}
          {contact?.bankAccount && <p className="text-slate-600">Žiro račun: {contact.bankAccount}</p>}
        </div>
        <div className="rounded-lg border border-slate-200 p-4 print:border-slate-400">
          <p className="text-xs uppercase tracking-wide text-slate-500">Kupac</p>
          <p className="mt-1 font-medium text-slate-900">{invoice.customer_name}</p>
          <p className="text-slate-600">{[invoice.customer_address, invoice.customer_city].filter(Boolean).join(", ")}</p>
          <p className="text-slate-600">
            {[
              customerTypeLabels[invoice.customer_type],
              invoice.customer_jib && `JIB ${invoice.customer_jib}`,
              invoice.customer_pdv_number && `PDV ${invoice.customer_pdv_number}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-4 print:grid-cols-4">
        <div>
          <dt className="text-slate-500">Datum izdavanja</dt>
          <dd className="font-medium text-slate-900">{formatDate(invoice.issue_date)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Dospijeće</dt>
          <dd className="font-medium text-slate-900">{formatDate(invoice.due_date)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Osnov</dt>
          <dd className="font-medium text-slate-900">
            {invoice.orderNumber ? `Narudžba ${invoice.orderNumber}` : `POS prodaja ${invoice.posSaleNumber}`}
          </dd>
        </div>
        {invoice.payment_method && (
          <div>
            <dt className="text-slate-500">Plaćeno</dt>
            <dd className="font-medium text-slate-900">{paymentMethodLabels[invoice.payment_method]}</dd>
          </div>
        )}
      </dl>

      {invoice.note && <p className="text-sm text-slate-600">{invoice.note}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Proizvod</TableHead>
            <TableHead className="text-right">Količina</TableHead>
            <TableHead className="text-right">Cijena</TableHead>
            <TableHead className="text-right">Popust</TableHead>
            <TableHead className="text-right">Osnovica</TableHead>
            <TableHead className="text-right">PDV</TableHead>
            <TableHead className="text-right">Ukupno</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoice.items.map((item) => (
            <TableRow key={item.product_id}>
              <TableCell>
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{item.sku}</p>
              </TableCell>
              <TableCell className="text-right">
                {item.quantity} {item.unit}
              </TableCell>
              <TableCell className="text-right">{formatMoney(item.unit_price)}</TableCell>
              <TableCell className="text-right">{item.discount_percent > 0 ? `${item.discount_percent} %` : "—"}</TableCell>
              <TableCell className="text-right">{formatMoney(item.net_amount)}</TableCell>
              <TableCell className="text-right">
                {formatMoney(item.vat_amount)}
                <span className="text-xs text-slate-400"> ({item.vat_rate} %)</span>
              </TableCell>
              <TableCell className="text-right font-medium text-slate-900">{formatMoney(item.gross_amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Osnovica</span>
          <span>{formatMoney(invoice.subtotal)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>PDV</span>
          <span>{formatMoney(invoice.vat_total)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-slate-900">
          <span>Ukupno za platiti</span>
          <span>{formatMoney(invoice.total)}</span>
        </div>
        {!isStorno && (
          <>
            <div className="flex justify-between text-slate-600">
              <span>Plaćeno</span>
              <span>{formatMoney(invoice.paid_amount)}</span>
            </div>
            <div className="flex justify-between font-medium text-slate-900">
              <span>Preostalo</span>
              <span>{formatMoney(invoice.balance)}</span>
            </div>
          </>
        )}
      </div>

      {showBankAccount && (
        <p className="text-sm text-slate-700">
          Uplatu izvršiti na žiro račun <span className="font-medium">{contact?.bankAccount}</span> do{" "}
          {formatDate(invoice.due_date)}, sa pozivom na broj fakture {invoice.number}.
        </p>
      )}

      {/* Only on paper: signatures and the company's closing line. */}
      {contact && (
        <div className="hidden space-y-8 pt-10 text-sm text-slate-700 print:block">
          <div className="grid grid-cols-2 gap-16">
            <p className="border-t border-slate-500 pt-1 text-center">Fakturisao</p>
            <p className="border-t border-slate-500 pt-1 text-center">Primio</p>
          </div>
          {contact.footer && <p className="whitespace-pre-line text-center text-xs text-slate-500">{contact.footer}</p>}
        </div>
      )}
    </div>
  );
}
