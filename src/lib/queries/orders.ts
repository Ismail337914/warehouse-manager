import type { OrderListParams } from "@/lib/query-keys";
import { PAGE_SIZE, pageRange, sanitizeSearch } from "@/lib/search";
import { orderTransitions, type OrderStatus } from "@/lib/order-status";

import type { DbClient } from "./client";

function isOrderStatus(value: string): value is OrderStatus {
  return value in orderTransitions;
}

export async function fetchOrders(client: DbClient, params: OrderListParams) {
  const { from, to } = pageRange(params.page);
  let query = client.from("order_list").select("*", { count: "exact" });

  const search = sanitizeSearch(params.q);
  if (search) query = query.or(`number.ilike.%${search}%,customer_name.ilike.%${search}%`);
  if (isOrderStatus(params.status)) query = query.eq("status", params.status);

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("number", { ascending: false })
    .range(from, to);
  if (error) throw new Error("Narudžbe nisu učitane.");
  return { rows: data, total: count ?? 0, pageSize: PAGE_SIZE };
}

// Order with its lines, the customer, every stock movement it caused and its invoice (if any).
export async function fetchOrder(client: DbClient, id: string) {
  const [order, movements, invoice] = await Promise.all([
    client
      .from("orders")
      .select(
        "*, customer:customers(id, name, customer_type, jib, pdv_number, address, city), items:order_items(product_id, quantity, unit_price, discount_percent, vat_rate, net_amount, vat_amount, gross_amount, product:products(sku, name, unit, available_quantity))",
      )
      .eq("id", id)
      .maybeSingle(),
    client
      .from("inventory_movements")
      .select("id, type, product_id, on_hand_change, reserved_change, reason, created_at")
      .eq("source_type", "narudzba")
      .eq("source_id", id)
      .order("created_at"),
    // The valid invoice; a stornirana one and its storno document stay in the invoice list.
    client
      .from("invoices")
      .select("id, number, status, total")
      .eq("order_id", id)
      .is("storno_of", null)
      .neq("status", "stornirana")
      .maybeSingle(),
  ]);

  if (order.error || movements.error || invoice.error) throw new Error("Narudžba nije učitana.");
  if (!order.data) return null;
  return { ...order.data, movements: movements.data, invoice: invoice.data };
}

export async function fetchActiveReservations(client: DbClient) {
  const { data, error } = await client
    .from("active_reservations")
    .select("*")
    .order("confirmed_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Rezervacije nisu učitane.");
  return data;
}

// Active users an order can be assigned to (admins and managers only; the database refuses sellers).
export async function fetchAssignableUsers(client: DbClient) {
  const { data, error } = await client.rpc("assignable_users");
  if (error) throw new Error("Korisnici nisu učitani.");
  return data;
}

export type OrderListRow = Awaited<ReturnType<typeof fetchOrders>>["rows"][number];
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof fetchOrder>>>;
