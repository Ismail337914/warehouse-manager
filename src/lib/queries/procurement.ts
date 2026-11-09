import type { DbClient } from "./client";

export async function fetchProcurementDocs(client: DbClient) {
  const { data, error } = await client
    .from("procurement_docs")
    .select("id, document_number, total, status, created_at, supplier:suppliers(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("Nabavke nisu učitane.");
  return data;
}
