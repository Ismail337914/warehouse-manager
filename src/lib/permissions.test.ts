import { describe, expect, it } from "vitest";

import { allPermissions, appRoles, can, canAccessRoute, type AppRole, type Permission } from "./permissions";

const A: AppRole = "admin";
const M: AppRole = "menadzer";
const P: AppRole = "prodavac";

// The agreed access policy, written out once more as a contract: changing a role's rights in permissions.ts
// without changing this table fails the test. The database enforces the same rules (tests/db/rbac.test.ts).
const expected: Record<Permission, AppRole[]> = {
  "dashboard.read": [A, M, P],
  "reports.read_own": [A, M, P],
  "reports.read_all": [A, M],

  "products.read": [A, M, P],
  "products.create": [A, M],
  "products.update": [A, M],
  "product_costs.read": [A, M],
  "categories.manage": [A, M],

  "stock.read": [A, M, P],
  "stock.receive": [A, M],
  "stock.adjust": [A, M],
  "stock.movements.read": [A, M],

  "customers.read": [A, M, P],
  "customers.create": [A, M, P],
  "customers.update": [A, M],
  "customers.delete": [A],

  "orders.read_own": [A, M, P],
  "orders.read_all": [A, M],
  "orders.create": [A, M, P],
  "orders.process": [A, M, P],
  "orders.assign": [A, M],
  "reservations.read": [A, M, P],

  "sales.create": [A, M, P],
  "sales.read_own": [A, M, P],
  "sales.read_all": [A, M],

  "invoices.read": [A, M, P],
  "invoices.issue": [A, M, P],
  "payments.record": [A, M],
  "invoices.storno": [A],

  "suppliers.manage": [A, M],
  "ads.manage": [A, M],

  "employees.read": [A, M],
  "employees.manage": [A],
  "users.manage_roles": [A],
  "settings.read": [A, M],
  "settings.manage": [A],
  "audit_logs.read": [A],

  "account.manage": [A, M, P],
};

describe("permission matrix", () => {
  it("matches the agreed policy for every role and permission", () => {
    for (const permission of allPermissions) {
      for (const role of appRoles) {
        expect(can(role, permission), `${role} → ${permission}`).toBe(expected[permission].includes(role));
      }
    }
  });

  it("gives admins every permission", () => {
    expect(allPermissions.every((permission) => can("admin", permission))).toBe(true);
  });

  it("keeps roles, users, settings, the audit log and storno away from managers", () => {
    for (const permission of [
      "users.manage_roles",
      "settings.manage",
      "audit_logs.read",
      "invoices.storno",
      "employees.manage",
    ] as const) {
      expect(can("menadzer", permission), permission).toBe(false);
    }
  });

  it("keeps stock changes, purchase prices, suppliers, staff data and company reports away from sellers", () => {
    for (const permission of [
      "stock.receive",
      "stock.adjust",
      "stock.movements.read",
      "product_costs.read",
      "products.update",
      "suppliers.manage",
      "categories.manage",
      "ads.manage",
      "employees.read",
      "orders.read_all",
      "sales.read_all",
      "reports.read_all",
      "payments.record",
      "customers.update",
    ] as const) {
      expect(can("prodavac", permission), permission).toBe(false);
    }
  });

  it("lets sellers sell, take and process their orders and issue invoices", () => {
    for (const permission of ["sales.create", "orders.create", "orders.process", "invoices.issue", "customers.create"] as const) {
      expect(can("prodavac", permission), permission).toBe(true);
    }
  });

  it("denies everything without a role", () => {
    for (const permission of allPermissions) {
      expect(can(null, permission)).toBe(false);
      expect(can(undefined, permission)).toBe(false);
    }
  });
});

describe("route access", () => {
  it("opens admin pages only to admins", () => {
    expect(canAccessRoute("admin", "/settings/users")).toBe(true);
    expect(canAccessRoute("menadzer", "/settings/users")).toBe(false);
    expect(canAccessRoute("menadzer", "/settings/audit")).toBe(false);
  });

  it("keeps sellers out of suppliers, categories, ads, settings, employees and stock documents", () => {
    for (const route of [
      "/warehouse/suppliers",
      "/warehouse/categories",
      "/ads",
      "/settings",
      "/settings/users",
      "/employees",
      "/reports",
      "/warehouse/receipts/new",
      "/warehouse/adjustments/new",
      "/warehouse/new",
    ] as const) {
      expect(canAccessRoute("prodavac", route), route).toBe(false);
    }
    for (const route of ["/", "/pos", "/sales", "/orders", "/orders/new", "/customers", "/invoices", "/warehouse", "/account/password"] as const) {
      expect(canAccessRoute("prodavac", route), route).toBe(true);
    }
  });
});
