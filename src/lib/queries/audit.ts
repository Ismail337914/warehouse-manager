import type { AuditListParams } from "@/lib/query-keys";
import { PAGE_SIZE, pageRange } from "@/lib/search";

import type { DbClient } from "./client";

// Admins only: RLS returns no rows to anyone else.
export async function fetchAuditLogs(client: DbClient, params: AuditListParams) {
  const { from, to } = pageRange(params.page);
  let query = client
    .from("audit_logs")
    .select("id, action, entity, entity_id, details, created_at, actor:profiles(email, full_name)", { count: "exact" });
  if (params.action) query = query.eq("action", params.action);

  const { data, count, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
  if (error) throw new Error("Audit log nije učitan.");
  return { rows: data, total: count ?? 0, pageSize: PAGE_SIZE };
}

export type AuditLogRow = Awaited<ReturnType<typeof fetchAuditLogs>>["rows"][number];
