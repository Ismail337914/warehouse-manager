import type { DbClient } from "./client";

export async function fetchListings(client: DbClient) {
  const { data, error } = await client
    .from("listings")
    .select("id, product_id, channel, external_id, url, price, status, created_at, updated_at, product:products(name, sku)")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) throw new Error("Oglasi nisu učitani.");
  return data;
}
