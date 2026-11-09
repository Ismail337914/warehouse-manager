import "server-only";

import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";

import { can, type CurrentUser, type Permission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

// Data Access Layer: the only place that reads the session. getClaims() verifies the JWT;
// the profile decides the role and whether the account is still active.
async function readCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.is_active) return null;

  return { id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role };
}

// For rendering. "use cache: private" is required with Cache Components because the token check compares
// against the current time. Calls within one request share the result, nothing is stored on the server, and the
// browser may reuse the rendered output for 30 s (refresh() after a mutation clears it).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  "use cache: private";
  cacheLife({ stale: 30 });
  return readCurrentUser();
}

// For pages: unauthenticated visitors go to the login page.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// For Server Actions: reads the session and role fresh on every call (never cached) and checks the permission,
// never trusting the UI.
export async function authorize(
  permission: Permission,
): Promise<{ ok: true; user: CurrentUser } | { ok: false; error: string }> {
  const user = await readCurrentUser();
  if (!user) return { ok: false, error: "Sesija je istekla. Prijavite se ponovo." };
  if (!can(user.role, permission)) return { ok: false, error: "Nemate ovlasti za ovu radnju." };
  return { ok: true, user };
}
