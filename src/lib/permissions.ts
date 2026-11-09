import type { Database } from "@/lib/supabase/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

// admin = administrator, menadzer = manager, prodavac = sales.
export const appRoles = ["admin", "menadzer", "prodavac"] as const satisfies readonly AppRole[];

export const roleLabels: Record<AppRole, string> = {
  admin: "Admin",
  menadzer: "Menadžer",
  prodavac: "Prodavač",
};

const everyone = appRoles;
const staff = ["admin", "menadzer"] as const satisfies readonly AppRole[];
const admins = ["admin"] as const satisfies readonly AppRole[];

// The single place that says which role may do what. Server Actions call authorize(), pages are wrapped in
// <RequireAccess>, and the UI uses can() only to hide what the user can't do. The database enforces the same
// rules independently (RLS policies and RPC functions, supabase/migrations/*_rbac.sql), including which
// records a seller owns ("_own" permissions: their own orders, POS sales and the invoices of those).
const permissions = {
  // Dashboard: everyone; a seller's figures cover only their own sales (dashboard_summary in the database).
  "dashboard.read": everyone,
  "reports.read_own": everyone,
  "reports.read_all": staff,

  "products.read": everyone,
  "products.create": staff,
  "products.update": staff,
  "product_costs.read": staff,
  "categories.manage": staff,

  "stock.read": everyone,
  "stock.receive": staff,
  "stock.adjust": staff,
  "stock.movements.read": staff,

  "customers.read": everyone,
  "customers.create": everyone,
  "customers.update": staff,
  "customers.delete": admins,

  "orders.read_own": everyone,
  "orders.read_all": staff,
  "orders.create": everyone,
  // Edit a draft, confirm, deliver, cancel. A seller only on orders they created or were assigned.
  "orders.process": everyone,
  "orders.assign": staff,
  "reservations.read": everyone,

  "sales.create": everyone,
  "sales.read_own": everyone,
  "sales.read_all": staff,

  "invoices.read": everyone,
  "invoices.issue": everyone,
  "payments.record": staff,
  "invoices.storno": admins,

  "suppliers.manage": staff,
  // Manual record of product ads (OLX, web, Viber); nothing is synchronised with the channels.
  "ads.manage": staff,

  "employees.read": staff,
  "employees.manage": admins,
  "users.manage_roles": admins,
  "settings.read": staff,
  "settings.manage": admins,
  "audit_logs.read": admins,

  // The signed-in user's own account (password change).
  "account.manage": everyone,
} as const satisfies Record<string, readonly AppRole[]>;

export type Permission = keyof typeof permissions;

export const allPermissions = Object.keys(permissions) as Permission[];

export function can(role: AppRole | null | undefined, permission: Permission) {
  if (!role) return false;
  return (permissions[permission] as readonly AppRole[]).includes(role);
}

// Which permission opens each page. The sidebar shows only the pages a role may open, and every page checks
// the same entry on the server (src/server/guards.tsx), so a typed URL is refused too.
export const routePermissions = {
  "/": "dashboard.read",
  "/warehouse": "products.read",
  "/warehouse/new": "products.create",
  "/warehouse/[id]": "products.read",
  "/warehouse/receipts/new": "stock.receive",
  "/warehouse/adjustments/new": "stock.adjust",
  "/warehouse/suppliers": "suppliers.manage",
  "/warehouse/categories": "categories.manage",
  "/pos": "sales.create",
  "/pos/[id]/print": "sales.read_own",
  "/sales": "sales.read_own",
  "/invoices": "invoices.read",
  "/invoices/[id]": "invoices.read",
  "/invoices/[id]/print": "invoices.read",
  "/orders": "orders.read_own",
  "/orders/new": "orders.create",
  "/orders/[id]": "orders.read_own",
  "/orders/[id]/edit": "orders.process",
  "/customers": "customers.read",
  "/customers/new": "customers.create",
  "/customers/[id]": "customers.read",
  "/reservations": "reservations.read",
  "/ads": "ads.manage",
  "/employees": "employees.read",
  "/reports": "reports.read_all",
  "/settings": "settings.read",
  "/settings/users": "users.manage_roles",
  "/settings/audit": "audit_logs.read",
  "/account/password": "account.manage",
} as const satisfies Record<string, Permission>;

export type AppRoute = keyof typeof routePermissions;

export function canAccessRoute(role: AppRole | null | undefined, route: AppRoute) {
  return can(role, routePermissions[route]);
}

// The signed-in user as pages and client components see it (resolved by src/server/auth.ts).
export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};
