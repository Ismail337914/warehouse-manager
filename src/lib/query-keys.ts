// All TanStack Query keys in one place. Every key starts with its entity, so invalidating ["products"]
// refreshes every product list, detail and history at once.

export type ProductListParams = { q: string; category: string; status: string; location: string; sort: string; page: number };
export type CustomerListParams = { q: string; type: string; page: number };
export type OrderListParams = { q: string; status: string; page: number };
export type InvoiceListParams = { q: string; status: string; month: string; page: number };
export type AuditListParams = { action: string; page: number };

export const queryKeys = {
  products: {
    all: ["products"] as const,
    locations: ["products", "locations"] as const,
    list: (params: ProductListParams) => ["products", "list", params] as const,
    detail: (id: string) => ["products", "detail", id] as const,
    movements: (id: string, page: number) => ["products", "movements", id, page] as const,
    options: ["products", "options"] as const,
    cost: (id: string) => ["products", "cost", id] as const,
    costs: ["products", "costs"] as const,
  },
  customers: {
    all: ["customers"] as const,
    list: (params: CustomerListParams) => ["customers", "list", params] as const,
    detail: (id: string) => ["customers", "detail", id] as const,
    options: ["customers", "options"] as const,
  },
  orders: {
    all: ["orders"] as const,
    list: (params: OrderListParams) => ["orders", "list", params] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
  },
  invoices: {
    all: ["invoices"] as const,
    list: (params: InvoiceListParams) => ["invoices", "list", params] as const,
    detail: (id: string) => ["invoices", "detail", id] as const,
  },
  posSales: {
    all: ["posSales"] as const,
    recent: ["posSales", "recent"] as const,
    detail: (id: string) => ["posSales", "detail", id] as const,
  },
  salesDocuments: (month: string) => ["salesDocuments", month] as const,
  dashboard: { all: ["dashboard"] as const },
  reservations: { all: ["reservations"] as const },
  users: { assignable: ["users", "assignable"] as const },
  audit: { list: (params: AuditListParams) => ["audit", "list", params] as const },
  categories: { all: ["categories"] as const, list: ["categories", "list"] as const },
  suppliers: { all: ["suppliers"] as const, list: ["suppliers", "list"] as const },
  procurement: { all: ["procurement"] as const },
  listings: { all: ["listings"] as const },
  settings: { all: ["settings"] as const },
};

// What each kind of change can affect. After a mutation the UI invalidates every listed entity.
export const invalidates = {
  // Categories too: their lists show how many products each has.
  product: [queryKeys.products.all, queryKeys.categories.all, queryKeys.dashboard.all],
  stock: [queryKeys.products.all, queryKeys.reservations.all, queryKeys.dashboard.all],
  customer: [queryKeys.customers.all, queryKeys.orders.all],
  order: [queryKeys.orders.all, queryKeys.products.all, queryKeys.reservations.all, queryKeys.dashboard.all],
  posSale: [queryKeys.posSales.all, queryKeys.products.all, queryKeys.dashboard.all],
  invoice: [queryKeys.invoices.all, queryKeys.orders.all, queryKeys.posSales.all, queryKeys.dashboard.all],
  category: [queryKeys.categories.all, queryKeys.products.all],
  supplier: [queryKeys.suppliers.all],
  settings: [queryKeys.settings.all],
} as const;
