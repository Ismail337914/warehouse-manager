import type { InvoiceListParams } from "@/lib/query-keys";
import { monthRange } from "@/lib/month";
import { PAGE_SIZE, pageRange, sanitizeSearch } from "@/lib/search";
import type { Database } from "@/lib/supabase/database.types";

import type { DbClient } from "./client";

export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];

const invoiceStatuses: readonly string[] = ["izdata", "djelimicno_placena", "placena", "stornirana"];

// status: one invoice status, "dospjele" (overdue) or "storno" (storno documents).
export async function fetchInvoices(client: DbClient, params: InvoiceListParams) {
  const { from, to } = pageRange(params.page);
  let query = client.from("invoice_list").select("*", { count: "exact" });

  const search = sanitizeSearch(params.q);
  if (search) query = query.or(`number.ilike.%${search}%,customer_name.ilike.%${search}%`);
  const range = params.month ? monthRange(params.month) : null;
  if (params.month && !range) throw new Error("Odabrani mjesec nije ispravan.");
  if (range) query = query.gte("issue_date", range.start).lt("issue_date", range.end);
  if (params.status === "dospjele") query = query.eq("is_overdue", true);
  else if (params.status === "storno") query = query.not("storno_of", "is", null);
  else if (invoiceStatuses.includes(params.status)) {
    query = query.eq("status", params.status as InvoiceStatus).is("storno_of", null);
  }

  const { data, count, error } = await query
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .range(from, to);
  if (error) throw new Error("Fakture nisu učitane.");
  return { rows: data, total: count ?? 0, pageSize: PAGE_SIZE };
}

// Invoice with its lines, payments, the storno document (or the invoice it cancels) and its source.
export async function fetchInvoice(client: DbClient, id: string) {
  const [invoice, items, payments, storno] = await Promise.all([
    client.from("invoice_list").select("*").eq("id", id).maybeSingle(),
    client.from("invoice_items").select("*").eq("invoice_id", id).order("name"),
    client.from("payments").select("id, amount, method, paid_on, note, created_at").eq("invoice_id", id).order("created_at"),
    client.from("invoices").select("id, number").eq("storno_of", id).maybeSingle(),
  ]);
  if (invoice.error || items.error || payments.error || storno.error) throw new Error("Faktura nije učitana.");
  if (!invoice.data) return null;

  const [header, original] = await Promise.all([
    client.from("invoices").select("*").eq("id", id).single(),
    invoice.data.storno_of
      ? client.from("invoices").select("id, number").eq("id", invoice.data.storno_of).single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (header.error || original.error) throw new Error("Faktura nije učitana.");

  return {
    ...header.data,
    balance: invoice.data.balance ?? 0,
    isOverdue: invoice.data.is_overdue ?? false,
    orderNumber: invoice.data.order_number,
    posSaleNumber: invoice.data.pos_sale_number,
    items: items.data,
    payments: payments.data,
    stornoDocument: storno.data,
    original: original.data,
  };
}

export type InvoiceListRow = Awaited<ReturnType<typeof fetchInvoices>>["rows"][number];
export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof fetchInvoice>>>;
