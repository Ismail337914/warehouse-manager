import type { AppRoute } from "@/lib/permissions";

// Sidebar links. Each one is shown only to roles that may open it (routePermissions in src/lib/permissions.ts).
export const navItems: Array<{ href: AppRoute; label: string }> = [
  { href: "/", label: "Pregled" },
  { href: "/warehouse", label: "Lager" },
  { href: "/pos", label: "POS / Prodaja" },
  { href: "/sales", label: "Pregled prodaja" },
  { href: "/invoices", label: "Fakture" },
  { href: "/orders", label: "Narudžbe" },
  { href: "/ads", label: "Oglasi" },
  { href: "/customers", label: "Kupci" },
  { href: "/reservations", label: "Rezervacije" },
  { href: "/employees", label: "Zaposlenici" },
  { href: "/reports", label: "Izvještaji" },
  { href: "/settings", label: "Postavke" },
];
