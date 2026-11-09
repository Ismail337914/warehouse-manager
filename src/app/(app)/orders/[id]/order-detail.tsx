"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";

import { QueryState } from "@/components/list";
import { useCurrentUser } from "@/components/providers";
import { OrderStatusBadge } from "@/components/status-badges";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormMessage,
  Input,
  NativeSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type Feedback,
} from "@/components/ui";
import { customerTypeLabels, invoiceStatusLabels, movementTypeLabels, orderSourceLabels } from "@/lib/labels";
import { canTransition, holdsReservation } from "@/lib/order-status";
import { can, roleLabels } from "@/lib/permissions";
import { fetchAssignableUsers, fetchOrder, type OrderDetail as Order } from "@/lib/queries/orders";
import { invalidates, queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useAction } from "@/lib/use-action";
import { useIdempotencyKey } from "@/lib/use-idempotency-key";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { invoiceOrder } from "@/server/actions/invoices";
import { assignOrder, cancelOrder, confirmOrder, deliverOrder } from "@/server/actions/orders";

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const order = useQuery({ queryKey: queryKeys.orders.detail(id), queryFn: () => fetchOrder(createClient(), id) });

  return (
    <div className="space-y-6">
      <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Nazad na narudžbe
      </Link>
      <QueryState isPending={order.isPending} error={order.error} isEmpty={!order.data} emptyText="Narudžba ne postoji.">
        {order.data && <OrderView order={order.data} />}
      </QueryState>
    </div>
  );
}

function OrderView({ order }: { order: Order }) {
  const productNames = new Map(order.items.map((item) => [item.product_id, item.product?.name ?? item.product_id]));

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-3">
                Narudžba {order.number}
                <OrderStatusBadge status={order.status} />
              </CardTitle>
              <p className="text-sm text-slate-500">
                {formatDateTime(order.created_at)} · {orderSourceLabels[order.source]}
                {order.note && ` · ${order.note}`}
              </p>
              <OrderAssignment order={order} />
            </div>
            <OrderActions order={order} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {order.customer && (
            <div className="rounded-lg border border-slate-200 p-4 text-sm">
              <p className="font-medium text-slate-900">
                <Link href={`/customers/${order.customer.id}`} className="hover:underline">
                  {order.customer.name}
                </Link>
              </p>
              <p className="text-slate-500">
                {customerTypeLabels[order.customer.customer_type]}
                {order.customer.jib && ` · JIB ${order.customer.jib}`}
                {order.customer.pdv_number && ` · PDV ${order.customer.pdv_number}`}
              </p>
              <p className="text-slate-500">{[order.customer.address, order.customer.city].filter(Boolean).join(", ")}</p>
            </div>
          )}

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
              {order.items.map((item) => (
                <TableRow key={item.product_id}>
                  <TableCell>
                    <Link href={`/warehouse/${item.product_id}`} className="font-medium text-slate-900 hover:underline">
                      {item.product?.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {item.product?.sku}
                      {order.status === "nacrt" && ` · dostupno ${item.product?.available_quantity}`}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.quantity} {item.product?.unit}
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
              <span>{formatMoney(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>PDV</span>
              <span>{formatMoney(order.vat_total)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-slate-900">
              <span>Ukupno</span>
              <span>{formatMoney(order.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kretanja zaliha</CardTitle>
          </CardHeader>
          <CardContent>
            {order.movements.length === 0 ? (
              <p className="text-sm text-slate-500">Narudžba još nije mijenjala zalihe (nacrt).</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {order.movements.map((movement) => (
                  <li key={movement.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                    <div>
                      <p className="font-medium text-slate-900">{productNames.get(movement.product_id)}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(movement.created_at)}</p>
                    </div>
                    <Badge variant={movement.on_hand_change < 0 ? "warning" : "secondary"}>
                      {movementTypeLabels[movement.type]}{" "}
                      {movement.on_hand_change !== 0 ? movement.on_hand_change : movement.reserved_change > 0 ? `+${movement.reserved_change}` : movement.reserved_change}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Faktura</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            <OrderInvoice order={order} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function OrderActions({ order }: { order: Order }) {
  const user = useCurrentUser();
  const idempotency = useIdempotencyKey();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const confirm = useAction(confirmOrder, invalidates.order);
  const deliver = useAction(deliverOrder, invalidates.order);
  const cancel = useAction(cancelOrder, invalidates.order);
  const isPending = confirm.isPending || deliver.isPending || cancel.isPending;

  if (!can(user.role, "orders.process")) return null;

  const run = async (action: () => ReturnType<typeof confirm.mutateAsync>, success: string) => {
    setFeedback(null);
    const result = await action();
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.error });
      return;
    }
    idempotency.renew();
    setCancelling(false);
    setFeedback({ tone: "info", text: success });
  };

  const input = { orderId: order.id };

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <div className="flex flex-wrap gap-2">
        {order.status === "nacrt" && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/orders/${order.id}/edit`}>
              <Pencil className="h-4 w-4" />
              Uredi
            </Link>
          </Button>
        )}
        {canTransition(order.status, "potvrđena") && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => run(() => confirm.mutateAsync({ ...input, idempotencyKey: idempotency.get() }), "Narudžba je potvrđena; roba je rezervisana.")}
          >
            Potvrdi i rezerviši
          </Button>
        )}
        {canTransition(order.status, "isporučena") && (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => run(() => deliver.mutateAsync({ ...input, idempotencyKey: idempotency.get() }), "Narudžba je isporučena; roba je skinuta sa stanja.")}
          >
            Isporuči
          </Button>
        )}
        {canTransition(order.status, "otkazana") && !cancelling && (
          <Button size="sm" variant="outline" className="text-red-600" disabled={isPending} onClick={() => setCancelling(true)}>
            Otkaži
          </Button>
        )}
      </div>
      {cancelling && (
        <div className="flex w-full flex-col gap-2 md:w-96 md:flex-row">
          <Input aria-label="Razlog otkazivanja" placeholder="Razlog otkazivanja (nije obavezno)" value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button
            size="sm"
            variant="danger"
            disabled={isPending}
            onClick={() =>
              run(
                () => cancel.mutateAsync({ ...input, reason, idempotencyKey: idempotency.get() }),
                holdsReservation(order.status) ? "Narudžba je otkazana; rezervacija je oslobođena." : "Narudžba je otkazana.",
              )
            }
          >
            Potvrdi otkazivanje
          </Button>
        </div>
      )}
      <FormMessage tone={feedback?.tone}>{feedback?.text}</FormMessage>
    </div>
  );
}

function OrderInvoice({ order }: { order: Order }) {
  const user = useCurrentUser();
  const idempotency = useIdempotencyKey();
  const issue = useAction(invoiceOrder, invalidates.invoice);
  const [error, setError] = useState("");

  if (order.invoice) {
    return (
      <p>
        <Link href={`/invoices/${order.invoice.id}`} className="font-medium text-slate-900 hover:underline">
          Faktura {order.invoice.number}
        </Link>{" "}
        · {formatMoney(order.invoice.total)} · {invoiceStatusLabels[order.invoice.status]} ·{" "}
        <Link href={`/invoices/${order.invoice.id}/print?print=1`} className="hover:underline">
          Štampaj fakturu
        </Link>
      </p>
    );
  }
  if (!canTransition(order.status, "fakturisana")) {
    return <p>Faktura se izdaje kada je narudžba isporučena.</p>;
  }
  if (!can(user.role, "invoices.issue")) return <p>Narudžba je isporučena i čeka fakturu.</p>;

  const onIssue = async () => {
    setError("");
    const result = await issue.mutateAsync({ orderId: order.id, idempotencyKey: idempotency.get() });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    idempotency.renew();
  };

  return (
    <div className="space-y-2">
      <p>Narudžba je isporučena i čeka fakturu.</p>
      <Button size="sm" disabled={issue.isPending} onClick={onIssue}>
        {issue.isPending ? "Izdavanje..." : "Izdaj fakturu"}
      </Button>
      <FormMessage>{error}</FormMessage>
    </div>
  );
}

// Who works on the order. Managers hand it to a seller, who then sees and processes it; the database checks
// both the manager's right (assign_order) and the seller's ownership on every later step.
function OrderAssignment({ order }: { order: Order }) {
  const user = useCurrentUser();
  const canAssign = can(user.role, "orders.assign") && order.status !== "otkazana" && order.status !== "fakturisana";
  const users = useQuery({
    queryKey: queryKeys.users.assignable,
    queryFn: () => fetchAssignableUsers(createClient()),
    enabled: can(user.role, "orders.assign"),
  });
  const assign = useAction(assignOrder, invalidates.order);
  const [selected, setSelected] = useState(order.assigned_to ?? "");
  const [error, setError] = useState("");

  if (!can(user.role, "orders.assign")) {
    return (
      <p className="text-sm text-slate-500">
        {order.assigned_to === user.id ? "Narudžba je dodijeljena vama." : "Narudžba je dodijeljena drugom prodavcu."}
      </p>
    );
  }

  const assignee = users.data?.find((option) => option.id === order.assigned_to);
  const label = (option: { full_name: string; email: string }) => option.full_name || option.email;

  if (!canAssign) {
    return <p className="text-sm text-slate-500">Prodavač: {assignee ? label(assignee) : "—"}</p>;
  }

  const onAssign = async () => {
    setError("");
    const result = await assign.mutateAsync({ orderId: order.id, userId: selected });
    if (!result.ok) setError(result.error);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
      <label htmlFor="order-assignee" className="text-slate-500">Prodavač</label>
      <NativeSelect id="order-assignee" className="h-8 w-56" value={selected} onChange={(event) => setSelected(event.target.value)}>
        <option value="">Odaberite...</option>
        {users.data?.map((option) => (
          <option key={option.id} value={option.id}>
            {label(option)} ({roleLabels[option.role]})
          </option>
        ))}
      </NativeSelect>
      <Button size="sm" variant="outline" disabled={!selected || selected === order.assigned_to || assign.isPending} onClick={onAssign}>
        Dodijeli
      </Button>
      <FormMessage className="w-full text-xs">{error}</FormMessage>
    </div>
  );
}
