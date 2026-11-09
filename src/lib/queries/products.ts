import type { ProductListParams } from "@/lib/query-keys";
import { PAGE_SIZE, pageRange, sanitizeSearch } from "@/lib/search";

import type { DbClient } from "./client";

// buy_price is not selectable through the API (sellers must not see purchase prices); staff read it with
// fetchProductCosts.
const productColumns =
  "id, sku, barcode, oem_number, name, unit, sell_price, vat_rate, quantity, reserved_quantity, available_quantity, min_quantity, is_low_stock, location, status, description, category_id, category:categories(id, name)";

// Search, filters and pagination run in PostgreSQL; the browser receives one page.
export async function fetchProducts(client: DbClient, params: ProductListParams) {
  const { from, to } = pageRange(params.page);
  let query = client.from("products").select(productColumns, { count: "exact" });

  const search = sanitizeSearch(params.q);
  if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%,oem_number.ilike.%${search}%`);
  if (params.category) query = query.eq("category_id", Number(params.category));
  if (params.location) query = query.eq("location", params.location);
  if (params.status === "low") query = query.eq("is_low_stock", true);
  else if (params.status === "active" || params.status === "inactive") query = query.eq("status", params.status);

  const sortOptions = {
    name: { column: "name", ascending: true },
    sku: { column: "sku", ascending: true },
    quantity: { column: "quantity", ascending: false },
    available: { column: "available_quantity", ascending: false },
    price: { column: "sell_price", ascending: false },
  } as const;
  const sort = sortOptions[params.sort as keyof typeof sortOptions] ?? sortOptions.name;
  const { data, count, error } = await query
    .order(sort.column, { ascending: sort.ascending })
    .order("id")
    .range(from, to);
  if (error) throw new Error("Proizvodi nisu učitani.");
  return { rows: data, total: count ?? 0, pageSize: PAGE_SIZE };
}

export async function fetchProductLocations(client: DbClient) {
  const locations = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("products")
      .select("location")
      .order("location")
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Lokacije proizvoda nisu učitane.");
    for (const row of data) locations.add(row.location);
    if (data.length < pageSize) return [...locations];
  }
}

export async function fetchProductsForExport(client: DbClient) {
  const pageSize = 1000;
  const rows: Array<{
    sku: string;
    name: string;
    oem_number: string | null;
    barcode: string | null;
    category: { name: string } | null;
    description: string;
    location: string;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number | null;
    min_quantity: number;
    unit: string;
    sell_price: number;
    vat_rate: number;
    status: string;
  }> = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("products")
      .select(
        "sku, name, oem_number, barcode, category:categories(name), description, location, quantity, reserved_quantity, available_quantity, min_quantity, unit, sell_price, vat_rate, status",
      )
      .order("name")
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Proizvodi nisu izvezeni.");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

export async function fetchProduct(client: DbClient, id: string) {
  const { data, error } = await client.from("products").select(productColumns).eq("id", id).maybeSingle();
  if (error) throw new Error("Proizvod nije učitan.");
  return data;
}

export async function fetchProductMovements(client: DbClient, productId: string, page: number) {
  const { from, to } = pageRange(page);
  const { data, count, error } = await client
    .from("inventory_movements")
    .select("id, type, on_hand_change, reserved_change, on_hand_after, reserved_after, source_type, source_id, reason, created_at", {
      count: "exact",
    })
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  if (error) throw new Error("Historija kretanja nije učitana.");
  return { rows: data, total: count ?? 0, pageSize: PAGE_SIZE };
}

// Active products for order lines, receipts and stock counts (selects in forms).
export async function fetchProductOptions(client: DbClient) {
  const { data, error } = await client
    .from("products")
    .select("id, sku, name, unit, sell_price, vat_rate, quantity, available_quantity, status")
    .order("name")
    .limit(1000);
  if (error) throw new Error("Proizvodi nisu učitani.");
  return data;
}

// Purchase prices (admin and manager only; the database refuses everyone else). Without ids: every product.
export async function fetchProductCosts(client: DbClient, ids?: string[]) {
  const { data, error } = await client.rpc("product_costs", ids ? { p_ids: ids } : {});
  if (error) throw new Error("Nabavne cijene nisu učitane.");
  return new Map(data.map((row) => [row.id, row.buy_price]));
}

export async function fetchCategories(client: DbClient) {
  const { data, error } = await client.from("categories").select("id, name").order("name");
  if (error) throw new Error("Kategorije nisu učitane.");
  return data;
}

// Categories with the number of products in each (a category with products can't be deleted), counted by the
// category_list view in the database.
export async function fetchCategoryList(client: DbClient) {
  const { data, error } = await client.from("category_list").select("id, name, product_count").order("name");
  if (error) throw new Error("Kategorije nisu učitane.");
  // Columns of a view are nullable in the generated types; they are never null here.
  return data.map((row) => ({ id: row.id ?? 0, name: row.name ?? "", productCount: row.product_count ?? 0 }));
}

export async function fetchSuppliers(client: DbClient) {
  const { data, error } = await client.from("suppliers").select("id, name").order("name");
  if (error) throw new Error("Dobavljači nisu učitani.");
  return data;
}

// Suppliers with all their details, for the management page (staff only; RLS returns nothing to sellers).
export async function fetchSupplierList(client: DbClient) {
  const { data, error } = await client
    .from("suppliers")
    .select("id, name, jib, pdv_number, address, city, phone, email, note")
    .order("name");
  if (error) throw new Error("Dobavljači nisu učitani.");
  return data;
}

export type CategoryListRow = Awaited<ReturnType<typeof fetchCategoryList>>[number];
export type SupplierListRow = Awaited<ReturnType<typeof fetchSupplierList>>[number];

export async function fetchSettings(client: DbClient) {
  const { data, error } = await client.from("settings").select("*").single();
  if (error) throw new Error("Postavke nisu učitane.");
  return data;
}

export type ProductRow = Awaited<ReturnType<typeof fetchProducts>>["rows"][number];
export type ProductOption = Awaited<ReturnType<typeof fetchProductOptions>>[number];
