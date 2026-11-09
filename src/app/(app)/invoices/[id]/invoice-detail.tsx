"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { useForm } from "react-hook-form";

import { QueryState } from "@/components/list";
import { useCurrentUser } from "@/components/providers";
import { InvoiceStatusBadge } from "@/components/status-badges";
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
import { paymentMethodLabels } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { fetchInvoice, type InvoiceDetail as Invoice } from "@/lib/queries/invoices";
import { invalidates, queryKeys } from "@/lib/query-keys";
import { paymentFormSchema, type PaymentFormValues } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { applyFieldErrors, useAction } from "@/lib/use-action";
import { useIdempotencyKey } from "@/lib/use-idempotency-key";
import { formatDate, formatDateTime, formatMoney, today } from "@/lib/utils";
import { recordPayment, stornoInvoice } from "@/server/actions/invoices";

import { InvoiceDocument } from "../invoice-document";

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const invoice = useQuery({ queryKey: queryKeys.invoices.detail(id), queryFn: () => fetchInvoice(createClient(), id) });

  return (
    <div className="space-y-6">
      <Link href="/invoices" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Nazad na fakture
      </Link>
      <QueryState isPending={invoice.isPending} error={invoice.error} isEmpty={!invoice.data} emptyText="Faktura ne postoji.">
        {invoice.data && <InvoiceView invoice={invoice.data} />}
      </QueryState>
    </div>
  );
}

function InvoiceView({ invoice }: { invoice: Invoice }) {
  const isStorno = Boolean(invoice.storno_of);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-3">
                {isStorno ? "Storno" : "Faktura"} {invoice.number}
                <InvoiceStatusBadge status={invoice.status} isStorno={isStorno} isOverdue={invoice.isOverdue} />
              </CardTitle>
              <p className="text-sm text-slate-500">
                {invoice.order_id ? (
                  <Link href={`/orders/${invoice.order_id}`} className="hover:underline">
                    Narudžba {invoice.orderNumber}
                  </Link>
                ) : (
                  <>POS prodaja {invoice.posSaleNumber}</>
                )}
                {invoice.original && (
                  <>
                    {" · storno fakture "}
                    <Link href={`/invoices/${invoice.original.id}`} className="hover:underline">
                      {invoice.original.number}
                    </Link>
                  </>
                )}
                {invoice.stornoDocument && (
                  <>
                    {" · stornirana dokumentom "}
                    <Link href={`/invoices/${invoice.stornoDocument.id}`} className="hover:underline">
                      {invoice.stornoDocument.number}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <InvoiceActions invoice={invoice} />
          </div>
        </CardHeader>
        <CardContent>
          <InvoiceDocument invoice={invoice} />
        </CardContent>
      </Card>

      {!isStorno && <Payments invoice={invoice} />}
    </>
  );
}

function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const user = useCurrentUser();
  const idempotency = useIdempotencyKey();
  const storno = useAction(stornoInvoice, invalidates.invoice);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Same rules as public.storno_invoice: not a storno document, not already cancelled, no payments.
  const canStorno =
    can(user.role, "invoices.storno") && !invoice.storno_of && invoice.status !== "stornirana" && invoice.payments.length === 0;

  const onStorno = async () => {
    setFeedback(null);
    const result = await storno.mutateAsync({ invoiceId: invoice.id, reason, idempotencyKey: idempotency.get() });
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.error });
      return;
    }
    idempotency.renew();
    setOpen(false);
    setFeedback({ tone: "info", text: `Faktura je stornirana dokumentom ${result.data.number}.` });
  };

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/invoices/${invoice.id}/print?print=1`}>
            <Printer className="h-4 w-4" />
            Štampaj
          </Link>
        </Button>
        {canStorno && !open && (
          <Button size="sm" variant="outline" className="text-red-600" onClick={() => setOpen(true)}>
            Storniraj
          </Button>
        )}
      </div>
      {open && (
        <div className="flex w-full flex-col gap-2 md:w-96 md:flex-row">
          <Input aria-label="Razlog storniranja" placeholder="Razlog storniranja (nije obavezno)" value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button size="sm" variant="danger" disabled={storno.isPending} onClick={onStorno}>
            Potvrdi storno
          </Button>
        </div>
      )}
      <FormMessage tone={feedback?.tone}>{feedback?.text}</FormMessage>
    </div>
  );
}

function Payments({ invoice }: { invoice: Invoice }) {
  const user = useCurrentUser();
  const canRecord = can(user.role, "payments.record") && invoice.status !== "stornirana" && invoice.balance > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uplate</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div>
          {invoice.payments.length === 0 ? (
            <p className="text-sm text-slate-500">
              {invoice.pos_sale_id ? "Plaćeno na kasi prilikom POS prodaje." : "Još nema evidentiranih uplata."}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {invoice.payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {formatDate(payment.paid_on)} · {paymentMethodLabels[payment.method]}
                    </p>
                    <p className="text-xs text-slate-500">
                      Evidentirano {formatDateTime(payment.created_at)}
                      {payment.note && ` · ${payment.note}`}
                    </p>
                  </div>
                  <span className="font-medium text-slate-900">{formatMoney(payment.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {canRecord && <PaymentForm invoice={invoice} />}
      </CardContent>
    </Card>
  );
}

function PaymentForm({ invoice }: { invoice: Invoice }) {
  const idempotency = useIdempotencyKey();
  const save = useAction(recordPayment, invalidates.invoice);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { amount: invoice.balance, method: "virman", paidOn: today(), note: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFeedback(null);
    const result = await save.mutateAsync({ ...values, invoiceId: invoice.id, idempotencyKey: idempotency.get() });
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.error });
      applyFieldErrors(setError, result.fieldErrors);
      return;
    }
    idempotency.renew();
    const remaining = result.data.total - result.data.paid_amount;
    reset({ amount: remaining, method: values.method, paidOn: today(), note: "" });
    setFeedback({ tone: "info", text: remaining > 0 ? `Uplata je evidentirana. Preostalo: ${formatMoney(remaining)}.` : "Faktura je plaćena." });
  });

  return (
    <form method="post" className="space-y-3 rounded-lg border border-slate-200 p-4" onSubmit={onSubmit} noValidate>
      <p className="text-sm font-medium text-slate-900">Nova uplata (dug {formatMoney(invoice.balance)})</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="payment-amount">Iznos (KM)</Label>
          <Input
            id="payment-amount"
            type="number"
            step="0.01"
            min={0.01}
            max={invoice.balance}
            aria-invalid={Boolean(errors.amount)}
            {...register("amount", { valueAsNumber: true })}
          />
          <FormMessage className="text-xs">{errors.amount?.message}</FormMessage>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment-date">Datum uplate</Label>
          <Input id="payment-date" type="date" max={today()} aria-invalid={Boolean(errors.paidOn)} {...register("paidOn")} />
          <FormMessage className="text-xs">{errors.paidOn?.message}</FormMessage>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment-method">Način plaćanja</Label>
          <NativeSelect id="payment-method" {...register("method")}>
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment-note">Napomena</Label>
          <Input id="payment-note" {...register("note")} />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Spremanje..." : "Evidentiraj uplatu"}
      </Button>
      <FormMessage tone={feedback?.tone}>{feedback?.text}</FormMessage>
    </form>
  );
}
