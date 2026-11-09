import "server-only";

import { Forbidden } from "@/components/forbidden";
import { canAccessRoute, type AppRoute } from "@/lib/permissions";
import { requireUser } from "@/server/auth";

// Server-side gate for a page: the page renders only for a role that may open the route (routePermissions in
// src/lib/permissions.ts); everyone else gets "Nemate pristup" and the page's components are never sent to the
// browser. Typing the URL directly makes no difference. This is not the only line of defence: the database
// (RLS, RPC functions) and every Server Action check access again.
export async function RequireAccess({ route, children }: { route: AppRoute; children: React.ReactNode }) {
  const user = await requireUser();
  if (!canAccessRoute(user.role, route)) return <Forbidden />;
  return children;
}
