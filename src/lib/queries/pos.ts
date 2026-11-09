import { sanitizeSearch } from "@/lib/search";

import type { DbClient } from "./client";

const posProductColumns = "id, sku, barcode, oem_number, name, unit, sell_price, vat_rate, available_quantity";

type ProductRow = { available_quantity: number | null };

// available_quantity is a generated column, so the generated types allow null; it is never null in practice.
const withAvailable = <T extends ProductRow>(product: T) => ({ ...product, available_quantity: product.available_quantity ?? 0 });

// Active products for the till, matched by name, code, barcode or OEM/catalogue number.
export async function searchPosProducts(client: DbClient, q: string) {
  let query = client.from("products").select(posProductColumns).eq("status", "active");
  const search = sanitizeSearch(q);
  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%,oem_number.ilike.%${search}%`);

  const { data, error } = await query.order("name").limit(24);
  if (error) throw new Error("Proizvodi nisu učitani.");
  return data.map(withAvailable);
}

// Exact barcode, SKU or OEM number, as a scanner types it followed by Enter.
export async function findProductByCode(client: DbClient, code: string) {
  const value = code.trim();
  if (!value) return null;
  const { data, error } = await client
    .from("products")
    .select(posProductColumns)
    .eq("status", "active")
    .or(`barcode.eq.${sanitizeSearch(value)},sku.ilike.${sanitizeSearch(value)},oem_number.ilike.${sanitizeSearch(value)}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Proizvod nije pronađen.");
  return data && withAvailable(data);
}

export async function fetchRecentPosSales(client: DbClient) {
  const { data, error } = await client
    .from("pos_sale_list")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw new Error("Prodaje nisu učitane.");
  return data;
}

// One sale with its lines (product name, code and unit from products) and the customer, for the printed receipt.
// RLS decides visibility: a seller sees only their own sales, staff see all.
export async function fetchPosSale(client: DbClient, id: string) {
  const { data, error } = await client
    .from("pos_sales")
    .select(
      "id, number, created_at, payment_method, discount_percent, subtotal, vat_total, total, customer:customers(name, jib, address, city), items:pos_sale_items(product_id, quantity, unit_price, discount_percent, vat_rate, net_amount, vat_amount, gross_amount, product:products(name, sku, unit))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Račun nije učitan.");
  return data;
}

export type PosProduct = Awaited<ReturnType<typeof searchPosProducts>>[number];
export type PosSaleReceipt = NonNullable<Awaited<ReturnType<typeof fetchPosSale>>>;
export type PosSaleRow = Awaited<ReturnType<typeof fetchRecentPosSales>>[number];
