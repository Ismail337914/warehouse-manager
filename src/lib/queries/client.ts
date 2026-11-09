import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

// Query functions take the client as a parameter: the UI passes the browser client, tests pass a client
// signed in as a specific role.
export type DbClient = SupabaseClient<Database>;
