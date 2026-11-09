"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileText, Minus, Plus, Printer, ScanBarcode, Trash2 } from "lucide-react";

import { useCurrentUser } from "@/components/providers";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormMessage,
  Input,
  Label,
  NativeSelect,
  type Feedback,
} from "@/components/ui";
import { maxDiscount } from "@/lib/discount";
import { paymentMethodLabels } from "@/lib/labels";
import { documentTotals, lineAmounts } from "@/lib/money";
import { can } from "@/lib/permissions";
import { fetchCustomerOptions } from "@/lib/queries/customers";
import { fetchSettings } from "@/lib/queries/products";
import { fetchRecentPosSales, findProductByCode, searchPosProducts, type PosProduct, type PosSaleRow } from "@/lib/queries/pos";
import { invalidates, queryKeys } from "@/lib/query-keys";
import type { PosSaleInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { useAction } from "@/lib/use-action";
import { useIdempotencyKey } from "@/lib/use-idempotency-key";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { invoicePosSale } from "@/server/actions/invoices";
import { completePosSale } from "@/server/actions/pos";

type CartLine = { product: PosProduct; quantity: number };
type PaymentMethod = PosSaleInput["paymentMethod"];
type LastSale = { id: string; number: string; total: number; hasCustomer: boolean };

// Price per piece with VAT, as the customer sees it at the till.
const grossPrice = (product: PosProduct) =>
  lineAmounts({ quantity: 1, unitPrice: product.sell_price, vatRate: product.vat_rate }).gross;

export function PosTerminal() {
  const user = useCurrentUser();
  const idempotency = useIdempotencyKey();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("gotovina");
  const [discount, setDiscount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [lastSale, setLastSale] = useState<LastSale | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const products = useQuery({
    queryKey: [...queryKeys.products.all, "pos", debouncedSearch],
    queryFn: () => searchPosProducts(createClient(), debouncedSearch),
  });
  const customers = useQuery({ queryKey: queryKeys.customers.options, queryFn: () => fetchCustomerOptions(createClient()) });
  const settings = useQuery({ queryKey: queryKeys.settings.all, queryFn: () => fetchSettings(createClient()) });

  const sale = useAction(completePosSale, invalidates.posSale);
  const limit = maxDiscount(user.role, settings.data);

  const inCart = (productId: string) => cart.find((line) => line.product.id === productId)?.quantity ?? 0;

  const addToCart = (product: PosProduct) => {
    setFeedback(null);
    if (inCart(product.id) >= product.available_quantity) {
      setFeedback({ tone: "error", text: `Nema više dostupnih komada: ${product.name}.` });
      return;
    }
    setCart((current) =>
      current.some((line) => line.product.id === product.id)
        ? current.map((line) => (line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line))
        : [...current, { product, quantity: 1 }],
    );
  };

  const setQuantity = (productId: string, quantity: number) => {
    setCart((current) =>
      current
        .map((line) => (line.product.id === productId ? { ...line, quantity: Math.max(0, Math.floor(quantity) || 0) } : line))
        .filter((line) => line.quantity > 0),
    );
  };

  // A scanner types the code and presses Enter: an exact barcode or code goes straight into the cart.
  const onScan = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const code = search.trim();
    if (!code) return;

    try {
      const product = await findProductByCode(createClient(), code);
      const match = product ?? (products.data?.length === 1 ? products.data[0] : null);
      if (!match) {
        setFeedback({ tone: "error", text: `Proizvod s kodom „${code}“ nije pronađen.` });
        return;
      }
      addToCart(match);
      setSearch("");
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Proizvod nije pronađen." });
    }
  };

  const totals = documentTotals(
    cart.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.product.sell_price,
      discountPercent: discount,
      vatRate: line.product.vat_rate,
    })),
  );
  const discountTooHigh = discount > limit;

  const checkout = async () => {
    setFeedback(null);
    setLastSale(null);
    const result = await sale.mutateAsync({
      idempotencyKey: idempotency.get(),
      customerId,
      paymentMethod,
      discountPercent: discount,
      items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    });
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.error });
      return;
    }
    idempotency.renew();
    setLastSale({ id: result.data.id, number: result.data.number, total: result.data.total, hasCustomer: customerId !== "" });
    setCart([]);
    setDiscount(0);
    setCustomerId("");
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Prodajna kasa</CardTitle>
            <div className="relative w-full md:w-80">
              <ScanBarcode className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                type="search"
                autoFocus
                aria-label="Naziv, šifra ili barkod (Enter dodaje u korpu)"
                placeholder="Naziv, šifra ili barkod + Enter"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={onScan}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {products.isPending ? (
            <p className="py-6 text-center text-sm text-slate-500">Učitavanje...</p>
          ) : products.error ? (
            <p role="alert" className="py-6 text-center text-sm text-red-600">{products.error.message}</p>
          ) : products.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Nema aktivnih proizvoda za ovu pretragu.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {products.data.map((product) => {
                const left = product.available_quantity - inCart(product.id);
                return (
                  <div key={product.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.sku}{product.barcode && ` · ${product.barcode}`}</p>
                        <p className="mt-1 text-sm text-slate-700">
                          {formatMoney(grossPrice(product))}
                          <span className="text-xs text-slate-400"> s PDV-om</span>
                        </p>
                      </div>
                      <Button size="sm" disabled={left <= 0} onClick={() => addToCart(product)}>
                        Dodaj
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Dostupno: {left} {product.unit}
                      {left <= 0 && " · nema više na stanju"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Korpa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-sm text-slate-500">Korpa je prazna. Skenirajte barkod ili dodajte proizvod.</p>
            ) : (
              <ul className="space-y-2">
                {cart.map((line) => (
                  <li key={line.product.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{line.product.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatMoney(grossPrice(line.product))} · dostupno {line.product.available_quantity} {line.product.unit}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" aria-label={`Ukloni ${line.product.name} iz korpe`} onClick={() => setQuantity(line.product.id, 0)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button variant="outline" size="sm" aria-label="Smanji količinu" onClick={() => setQuantity(line.product.id, line.quantity - 1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        className="h-8 w-20 text-center"
                        type="number"
                        min={1}
                        max={line.product.available_quantity}
                        aria-label={`Količina: ${line.product.name}`}
                        value={line.quantity}
                        onChange={(event) => setQuantity(line.product.id, event.target.valueAsNumber)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Povećaj količinu"
                        disabled={line.quantity >= line.product.available_quantity}
                        onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pos-payment">Način plaćanja</Label>
                <NativeSelect id="pos-payment" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos-discount">Popust (najviše {limit} %)</Label>
                <Input
                  id="pos-discount"
                  type="number"
                  min={0}
                  max={limit}
                  step="0.01"
                  aria-invalid={discountTooHigh}
                  value={discount}
                  onChange={(event) => setDiscount(Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : 0)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pos-customer">Kupac (po izboru, potreban za fakturu)</Label>
              <NativeSelect id="pos-customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Bez kupca</option>
                {customers.data?.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </NativeSelect>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Osnovica (bez PDV-a)</span>
                <span>{formatMoney(totals.net)}</span>
              </div>
              <div className="mt-1 flex justify-between text-slate-600">
                <span>PDV</span>
                <span>{formatMoney(totals.vat)}</span>
              </div>
              <div className="mt-2 flex justify-between text-lg font-semibold text-slate-900">
                <span>Ukupno</span>
                <span>{formatMoney(totals.gross)}</span>
              </div>
            </div>

            <Button className="w-full" disabled={cart.length === 0 || discountTooHigh || sale.isPending} onClick={checkout}>
              {sale.isPending ? "Naplata..." : "Naplati"}
            </Button>
            {discountTooHigh && <FormMessage className="text-xs">Popust može biti najviše {limit} %.</FormMessage>}
            <FormMessage tone={feedback?.tone}>{feedback?.text}</FormMessage>
            {lastSale && <SaleDone sale={lastSale} canInvoice={can(user.role, "invoices.issue")} />}
          </CardContent>
        </Card>

        <RecentSales canInvoice={can(user.role, "invoices.issue")} />
      </div>
    </div>
  );
}

// Shown after a sale: print the receipt at once, or (with a customer) issue the invoice and print it.
function SaleDone({ sale, canInvoice }: { sale: LastSale; canInvoice: boolean }) {
  const router = useRouter();
  const idempotency = useIdempotencyKey();
  const issue = useAction(invoicePosSale, invalidates.invoice);
  const [error, setError] = useState("");

  const onInvoice = async () => {
    setError("");
    const result = await issue.mutateAsync({ posSaleId: sale.id, idempotencyKey: idempotency.get() });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    idempotency.renew();
    router.push(`/invoices/${result.data.id}/print?print=1`);
  };

  return (
    <div role="status" className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <p className="font-medium text-emerald-900">
        Prodaja {sale.number} je naplaćena: {formatMoney(sale.total)}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={`/pos/${sale.id}/print?print=1`}>
            <Printer className="h-4 w-4" />
            Štampaj račun
          </Link>
        </Button>
        {canInvoice && sale.hasCustomer && (
          <Button size="sm" variant="outline" disabled={issue.isPending} onClick={onInvoice}>
            <FileText className="h-4 w-4" />
            {issue.isPending ? "Izdavanje..." : "Izdaj i štampaj fakturu"}
          </Button>
        )}
      </div>
      {error && <FormMessage className="text-xs">{error}</FormMessage>}
    </div>
  );
}

function RecentSales({ canInvoice }: { canInvoice: boolean }) {
  const sales = useQuery({ queryKey: queryKeys.posSales.recent, queryFn: () => fetchRecentPosSales(createClient()) });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zadnje prodaje</CardTitle>
      </CardHeader>
      <CardContent>
        {sales.isPending ? (
          <p className="text-sm text-slate-500">Učitavanje...</p>
        ) : sales.error ? (
          <p role="alert" className="text-sm text-red-600">{sales.error.message}</p>
        ) : sales.data.length === 0 ? (
          <p className="text-sm text-slate-500">Još nema prodaja.</p>
        ) : (
          <ul className="space-y-2">
            {sales.data.map((sale) => (
              <RecentSale key={sale.id} sale={sale} canInvoice={canInvoice} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentSale({ sale, canInvoice }: { sale: PosSaleRow; canInvoice: boolean }) {
  const idempotency = useIdempotencyKey();
  const issue = useAction(invoicePosSale, invalidates.invoice);
  const [error, setError] = useState("");

  const onIssue = async () => {
    if (!sale.id) return;
    setError("");
    const result = await issue.mutateAsync({ posSaleId: sale.id, idempotencyKey: idempotency.get() });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    idempotency.renew();
  };

  return (
    <li className="rounded-lg border border-slate-200 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">{sale.number}</p>
          <p className="text-slate-500">
            {sale.created_at && formatDateTime(sale.created_at)} · {sale.payment_method && paymentMethodLabels[sale.payment_method]}
          </p>
          <p className="text-slate-500">{sale.customer_name ?? "Bez kupca"}</p>
        </div>
        <div className="flex flex-col items-end text-right">
          <p className="font-medium text-slate-900">{formatMoney(sale.total ?? 0)}</p>
          {sale.id && (
            <Link href={`/pos/${sale.id}/print?print=1`} className="text-xs text-slate-600 hover:underline">
              Štampaj račun
            </Link>
          )}
          {sale.invoice_id ? (
            <span className="text-xs text-slate-600">
              <Link href={`/invoices/${sale.invoice_id}`} className="hover:underline">
                Faktura {sale.invoice_number}
              </Link>
              {" · "}
              <Link href={`/invoices/${sale.invoice_id}/print?print=1`} className="hover:underline">
                Štampaj
              </Link>
            </span>
          ) : (
            canInvoice &&
            sale.customer_id && (
              <Button size="sm" variant="outline" className="mt-1" disabled={issue.isPending} onClick={onIssue}>
                Izdaj fakturu
              </Button>
            )
          )}
        </div>
      </div>
      {error && <FormMessage className="mt-1 text-xs">{error}</FormMessage>}
    </li>
  );
}
