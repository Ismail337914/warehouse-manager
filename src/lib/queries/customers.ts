import type { CustomerListParams } from "@/lib/query-keys";
import { PAGE_SIZE, pageRange, sanitizeSearch } from "@/lib/search";

import type { DbClient } from "./client";

const customerColumns = "id, customer_type, name, jib, pdv_number, phone, email, address, city, notes, created_at";

export async function fetchCustomers(client: DbClient, params: CustomerListParams) {
  const { from, to } = pageRange(params.page);
  let query = client.from("customers").select(customerColumns, { count: "exact" });

  const search = sanitizeSearch(params.q);
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,jib.ilike.%${search}%`);
  }
  if (params.type === "fizicko" || params.type === "pravno") query = query.eq("customer_type", params.type);

  const { data, count, error } = await query.order("name").range(from, to);
  if (error) throw new Error("Kupci nisu učitani.");
  return { rows: data, total: count ?? 0, pageSize: PAGE_SIZE };
}

export async function fetchCustomersForExport(client: DbClient) {
  const pageSize = 1000;
  const rows: Array<{
    name: string;
    customer_type: string;
    jib: string | null;
    pdv_number: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    notes: string;
  }> = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("customers")
      .select("name, customer_type, jib, pdv_number, phone, email, address, city, notes")
      .order("name")
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Kupci nisu izvezeni.");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

export async function fetchCustomer(client: DbClient, id: string) {
  const { data, error } = await client.from("customers").select(customerColumns).eq("id", id).maybeSingle();
  if (error) throw new Error("Kupac nije učitan.");
  return data;
}

export async function fetchCustomerOptions(client: DbClient) {
  const { data, error } = await client.from("customers").select("id, name, customer_type").order("name").limit(1000);
  if (error) throw new Error("Kupci nisu učitani.");
  return data;
}

export type CustomerRow = Awaited<ReturnType<typeof fetchCustomers>>["rows"][number];
