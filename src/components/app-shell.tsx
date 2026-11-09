"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarRange,
  FileText,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  ChartNoAxesCombined,
  Megaphone,
  Users,
  Warehouse,
  X,
} from "lucide-react";

import { useCurrentUser } from "@/components/providers";
import { Button } from "@/components/ui";
import { navItems } from "@/lib/navigation";
import { canAccessRoute } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const iconsMap = {
  "/": LayoutDashboard,
  "/warehouse": Warehouse,
  "/pos": ShoppingCart,
  "/sales": ChartNoAxesCombined,
  "/invoices": FileText,
  "/orders": Package,
  "/ads": Megaphone,
  "/customers": Users,
  "/reservations": CalendarRange,
  "/employees": BriefcaseBusiness,
  "/reports": BarChart3,
  "/settings": Settings,
};

// "/settings/users" belongs to "/settings"; "/" only matches the dashboard itself.
function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Only the modules the user's role may open. Hiding a link is a convenience; each page checks access on the server.
function useAllowedNavItems() {
  const user = useCurrentUser();
  return navItems.filter((item) => canAccessRoute(user.role, item.href));
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const items = useAllowedNavItems();

  return (
    <nav className="space-y-1.5">
      {items.map((item) => {
        const Icon = iconsMap[item.href as keyof typeof iconsMap] ?? LayoutDashboard;
        const isActive = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-emerald-300 text-slate-950"
                : "text-slate-300 hover:bg-slate-900 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, userMenu }: { children: React.ReactNode; userMenu: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeLabel =
    navItems.find((item) => isActivePath(pathname, item.href))?.label ?? "Pregled";

  return (
    <div className="min-h-screen">
      <div className="app-sidebar fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-slate-950 px-5 py-6 text-slate-100 md:flex md:flex-col print:hidden">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-300 text-lg font-bold text-slate-950">
            WM
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ops</p>
            <h1 className="text-lg font-semibold">Warehouse Manager</h1>
          </div>
        </div>

        <NavLinks pathname={pathname} />
      </div>

      <div className="md:ml-72 print:ml-0">
        <header className="app-header sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md print:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
            <div className="flex items-center gap-3">
              <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
                <Dialog.Trigger asChild>
                  <Button variant="outline" size="icon" className="md:hidden" aria-label="Otvori meni">
                    <Menu className="h-5 w-5" />
                  </Button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50 md:hidden" />
                  <Dialog.Content
                    aria-describedby={undefined}
                    className="app-sidebar fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-slate-950 px-5 py-6 text-slate-100 md:hidden"
                  >
                    <div className="mb-6 flex items-center justify-between">
                      <Dialog.Title className="text-lg font-semibold">Warehouse Manager</Dialog.Title>
                      <Dialog.Close
                        className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-white"
                        aria-label="Zatvori meni"
                      >
                        <X className="h-5 w-5" />
                      </Dialog.Close>
                    </div>
                    <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Modul</p>
                <h2 className="text-xl font-semibold text-slate-900">{activeLabel}</h2>
              </div>
            </div>

            {userMenu}
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 sm:py-8 print:p-0">{children}</main>
      </div>
    </div>
  );
}

// Shown while the session is read: the same frame without links, so the page doesn't jump.
export function AppShellSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="app-sidebar fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-slate-950 md:block print:hidden" />
      <div className="md:ml-72 print:ml-0">
        <div className="app-header h-[73px] border-b border-slate-200 bg-white/80 print:hidden" />
        <p className="px-6 py-8 text-sm text-slate-500">Učitavanje...</p>
      </div>
    </div>
  );
}
