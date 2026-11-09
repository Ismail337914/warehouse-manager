import { Badge, type BadgeProps } from "@/components/ui";
import { invoiceStatusLabels } from "@/lib/labels";
import type { InvoiceStatus } from "@/lib/queries/invoices";
import { orderStatusLabels, type OrderStatus } from "@/lib/order-status";

const orderStatusVariant: Record<OrderStatus, BadgeProps["variant"]> = {
  nacrt: "secondary",
  potvrđena: "warning",
  isporučena: "success",
  fakturisana: "success",
  otkazana: "danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={orderStatusVariant[status]}>{orderStatusLabels[status]}</Badge>;
}

const invoiceStatusVariant: Record<InvoiceStatus, BadgeProps["variant"]> = {
  izdata: "warning",
  djelimicno_placena: "warning",
  placena: "success",
  stornirana: "secondary",
};

// A storno document is shown as "Storno"; an unpaid invoice past its due date as "Dospjela".
export function InvoiceStatusBadge({
  status,
  isStorno = false,
  isOverdue = false,
}: {
  status: InvoiceStatus;
  isStorno?: boolean;
  isOverdue?: boolean;
}) {
  if (isStorno) return <Badge variant="danger">Storno</Badge>;
  if (isOverdue) return <Badge variant="danger">Dospjela · {invoiceStatusLabels[status]}</Badge>;
  return <Badge variant={invoiceStatusVariant[status]}>{invoiceStatusLabels[status]}</Badge>;
}

export function StockBadge({ quantity, minQuantity, isActive }: { quantity: number; minQuantity: number; isActive: boolean }) {
  if (!isActive) return <Badge variant="secondary">Neaktivan</Badge>;
  if (quantity <= minQuantity) return <Badge variant="warning">Niska zaliha</Badge>;
  return <Badge variant="success">Aktivan</Badge>;
}
