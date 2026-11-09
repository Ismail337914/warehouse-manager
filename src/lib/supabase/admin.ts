import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

// Service role client: bypasses Row Level Security. Server-only ("server-only" import above). Used for auth admin
// operations (creating users, banning deactivated users) after the caller is authorized as admin, and for the
// sign-in attempt counter, which reads and writes only hashed keys.
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Nedostaje SUPABASE_SERVICE_ROLE_KEY u .env.local.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
