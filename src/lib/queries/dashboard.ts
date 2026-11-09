import { z } from "zod";

import { monthRange } from "@/lib/month";

import type { DbClient } from "./client";

// Shape returned by public.dashboard_summary(). Turnover includes VAT.
const summarySchema = z.object({
  // "own" for a seller: every figure covers only their own sales, orders and invoices.
  scope: z.enum(["all", "own"]),
  revenue_today: z.number(),
  revenue_month: z.number(),
  sales_today: z.number(),
  sales_month: z.number(),
  average_basket: z.number(),
  top_products: z.array(
    z.object({ product_id: z.string(), name: z.string(), unit: z.string(), quantity: z.number(), revenue: z.number() }),
  ),
  low_stock_count: z.number(),
  open_orders: z.number(),
  unpaid_count: z.number(),
  unpaid_amount: z.number(),
  overdue_count: z.number(),
  overdue_amount: z.number(),
});

export type DashboardSummary = z.infer<typeof summarySchema>;

export async function fetchDashboardSummary(client: DbClient) {
  const { data, error } = await client.rpc("dashboard_summary");
  const parsed = summarySchema.safeParse(data);
  if (error || !parsed.success) throw new Error("Pregled nije učitan.");
  return parsed.data;
}

export async function fetchSalesByMonth(client: DbClient) {
  const { data, error } = await client.rpc("sales_by_month", { p_months: 12 });
  if (error) throw new Error("Prodaja po mjesecima nije učitana.");
  return data;
}

export async function fetchMonthlyStornoCount(client: DbClient, month: string) {
  const range = monthRange(month);
  if (!range) throw new Error("Odabrani mjesec nije ispravan.");
  const { count, error } = await client
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .not("storno_of", "is", null)
    .gte("issue_date", range.start)
    .lt("issue_date", range.end);
  if (error) throw new Error("Broj storniranih faktura nije učitan.");
  return count ?? 0;
}

export async function fetchSalesDocumentsByMonth(client: DbClient, month: string) {
  const range = monthRange(month);
  if (!range) throw new Error("Odabrani mjesec nije ispravan.");
  const { data, error } = await client.rpc("sales_documents_by_month", { p_month: range.start });
  if (error) throw new Error("Detalji prodaje nisu učitani.");
  return data;
}

export async function fetchLowStockProducts(client: DbClient) {
  const { data, error } = await client
    .from("products")
    .select("id, name, location, quantity, min_quantity, unit")
    .eq("is_low_stock", true)
    .eq("status", "active")
    .order("quantity")
    .limit(5);
  if (error) throw new Error("Niske zalihe nisu učitane.");
  return data;
}

export async function fetchRecentOrders(client: DbClient) {
  const { data, error } = await client.from("order_list").select("*").order("created_at", { ascending: false }).limit(5);
  if (error) throw new Error("Narudžbe nisu učitane.");
  return data;
}
