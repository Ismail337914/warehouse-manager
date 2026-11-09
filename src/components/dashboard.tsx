"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CircleDollarSign, FileX, Receipt, ShoppingBasket } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { QueryState } from "@/components/list";
import { useCurrentUser } from "@/components/providers";
import { OrderStatusBadge } from "@/components/status-badges";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  fetchMonthlyStornoCount,
  fetchDashboardSummary,
  fetchLowStockProducts,
  fetchRecentOrders,
  fetchSalesByMonth,
  type DashboardSummary,
} from "@/lib/queries/dashboard";
import { can, canAccessRoute, type AppRoute } from "@/lib/permissions";
import { queryKeys } from "@/lib/query-keys";
import { currentMonthKey } from "@/lib/month";
import { createClient } from "@/lib/supabase/client";
import { formatMoney, formatNumber } from "@/lib/utils";

const monthFormat = new Intl.DateTimeFormat("hr-HR", { month: "short", year: "2-digit", timeZone: "UTC" });

const quickActions: Array<{ route: AppRoute; href: string; label: string }> = [
  { route: "/pos", href: "/pos", label: "Započni prodaju" },
  { route: "/orders/new", href: "/orders/new", label: "Kreiraj narudžbu" },
  { route: "/warehouse/receipts/new", href: "/warehouse/receipts/new", label: "Prijem robe" },
  { route: "/invoices", href: "/invoices?status=dospjele", label: "Dospjele fakture" },
];

// Every figure comes from the database (dashboard_summary, sales_by_month). Turnover includes VAT.
// Staff see the company's figures; a seller sees only their own sales, orders and invoices (the database
// decides the scope, the titles here follow the same permission).
export function DashboardPage() {
  const user = useCurrentUser();
  const own = !can(user.role, "sales.read_all");
  const summary = useQuery({
    queryKey: [...queryKeys.dashboard.all, "summary"],
    queryFn: () => fetchDashboardSummary(createClient()),
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{own ? "Moji rezultati" : "Pregled poslovanja"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {own ? "Vaše prodaje, narudžbe i fakture" : "Prodaja, fakture i zalihe na jednom mjestu"}
        </h1>
      </div>

      <QueryState isPending={summary.isPending} error={summary.error}>
        {summary.data && (
          <div className="space-y-4">
            <StatCards summary={summary.data} own={own} />
            <StornoCard month={currentMonthKey()} />
          </div>
        )}
      </QueryState>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <SalesChart own={own} />
        <Card>
          <CardHeader>
            <CardTitle>Brze akcije</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions
              .filter((action) => canAccessRoute(user.role, action.route))
              .map((action) => (
                <QuickAction key={action.href} href={action.href} label={action.label} />
              ))}
          </CardContent>
        </Card>
      </div>

      {summary.data && (
        <div className="grid gap-6 xl:grid-cols-3">
          <TopProducts summary={summary.data} own={own} />
          <UnpaidInvoices summary={summary.data} own={own} />
          <LowStock count={summary.data.low_stock_count} />
        </div>
      )}

      <RecentOrders own={own} />
    </div>
  );
}

function StatCards({ summary, own }: { summary: DashboardSummary; own: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title={own ? "Moj promet danas" : "Promet danas"}
        value={formatMoney(summary.revenue_today)}
        hint={`Prodaja danas: ${summary.sales_today} · iznosi s PDV-om`}
        icon={<CircleDollarSign className="h-5 w-5" />}
        tone="success"
      />
      <StatCard
        title={own ? "Moj promet ovaj mjesec" : "Promet ovaj mjesec"}
        value={formatMoney(summary.revenue_month)}
        hint={own ? "Vaše POS prodaje i fakture vaših narudžbi" : "POS prodaje i fakture narudžbi, umanjeno za storno"}
        icon={<Receipt className="h-5 w-5" />}
      />
      <StatCard
        title={own ? "Moje prodaje (mjesec)" : "Broj prodaja (mjesec)"}
        value={String(summary.sales_month)}
        hint="POS računi i fakturisane narudžbe"
        icon={<ShoppingBasket className="h-5 w-5" />}
      />
      <StatCard
        title="Prosječna korpa"
        value={formatMoney(summary.average_basket)}
        hint="Promet mjeseca / broj prodaja"
        icon={<ShoppingBasket className="h-5 w-5" />}
      />
    </div>
  );
}

function SalesChart({ own }: { own: boolean }) {
  const router = useRouter();
  const sales = useQuery({
    queryKey: [...queryKeys.dashboard.all, "salesByMonth"],
    queryFn: () => fetchSalesByMonth(createClient()),
  });
  const data = (sales.data ?? []).map((row) => ({
    monthKey: row.month.slice(0, 7),
    month: monthFormat.format(new Date(row.month)),
    value: row.revenue,
  }));
  const [previous, current] = data.slice(-2);
  const growth = previous && current && previous.value > 0 ? ((current.value - previous.value) / previous.value) * 100 : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{own ? "Moj promet po mjesecima" : "Promet po mjesecima"}</CardTitle>
          {growth !== null && (
            <Badge variant={growth >= 0 ? "success" : "danger"}>
              {formatNumber(growth, { maximumFractionDigits: 1, signDisplay: "exceptZero" })}% u odnosu na {previous.month}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <QueryState isPending={sales.isPending} error={sales.error}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                onClick={(event) => {
                  const index = event?.activeTooltipIndex;
                  if (typeof index === "number" && data[index]) router.push(`/sales?month=${data[index].monthKey}`);
                }}
                style={{ cursor: "pointer" }}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [formatMoney(Number(value ?? 0)), "Promet"]} />
                <Area type="monotone" dataKey="value" stroke="#0f172a" strokeWidth={2} fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-right text-sm">
            <Link href={`/sales?month=${currentMonthKey()}`} className="text-slate-600 underline underline-offset-4 hover:text-slate-900">
              Otvori detalje prodaje za ovaj mjesec
            </Link>
          </p>
        </QueryState>
      </CardContent>
    </Card>
  );
}

function StornoCard({ month }: { month: string }) {
  const count = useQuery({
    queryKey: [...queryKeys.dashboard.all, "monthlyStorno", month],
    queryFn: () => fetchMonthlyStornoCount(createClient(), month),
  });

  return (
    <QueryState isPending={count.isPending} error={count.error}>
      {count.data !== undefined && (
        <Link href={`/invoices?status=storno&month=${month}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">
          <Card className="transition-colors hover:border-slate-400 hover:bg-slate-50">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm text-slate-500">Stornirani računi ovaj mjesec</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{count.data}</p>
                <p className="mt-1 text-sm text-slate-500">Otvori storno dokumente za {monthFormat.format(new Date(`${month}-01`))}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">
                <FileX className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
    </QueryState>
  );
}

function TopProducts({ summary, own }: { summary: DashboardSummary; own: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{own ? "Moji najprodavaniji ovaj mjesec" : "Najprodavaniji ovaj mjesec"}</CardTitle>
      </CardHeader>
      <CardContent>
        {summary.top_products.length === 0 ? (
          <p className="text-sm text-slate-500">Ovaj mjesec još nema prodaja.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {summary.top_products.map((product, index) => (
              <li key={product.product_id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <Link href={`/warehouse/${product.product_id}`} className="font-medium text-slate-900 hover:underline">
                    {index + 1}. {product.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {product.quantity} {product.unit}
                  </p>
                </div>
                <span className="font-medium text-slate-900">{formatMoney(product.revenue)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function UnpaidInvoices({ summary, own }: { summary: DashboardSummary; own: boolean }) {
  return (
    <Card className={summary.overdue_count > 0 ? "border-red-200" : undefined}>
      <CardHeader>
        <CardTitle>{own ? "Moje neplaćene fakture" : "Neplaćene fakture"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Otvorene ({summary.unpaid_count})</span>
          <span className="font-semibold text-slate-900">{formatMoney(summary.unpaid_amount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={summary.overdue_count > 0 ? "text-red-600" : "text-slate-600"}>Dospjele ({summary.overdue_count})</span>
          <span className={summary.overdue_count > 0 ? "font-semibold text-red-600" : "font-semibold text-slate-900"}>
            {formatMoney(summary.overdue_amount)}
          </span>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={summary.overdue_count > 0 ? "/invoices?status=dospjele" : "/invoices"}>Otvori fakture</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function LowStock({ count }: { count: number }) {
  const products = useQuery({
    queryKey: [...queryKeys.dashboard.all, "lowStock"],
    queryFn: () => fetchLowStockProducts(createClient()),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Niske zalihe
          {count > 0 && <Badge variant="warning">{count}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <QueryState isPending={products.isPending} error={products.error} isEmpty={products.data?.length === 0} emptyText="Sve zalihe su iznad minimuma.">
          {products.data?.map((product) => (
            <Link key={product.id} href={`/warehouse/${product.id}`} className="block rounded-lg border border-amber-200 bg-amber-50 p-3 hover:bg-amber-100">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 font-medium text-slate-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  {product.name}
                </p>
                <Badge variant="warning">
                  {product.quantity}/{product.min_quantity} {product.unit}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">{product.location}</p>
            </Link>
          ))}
          {count > 5 && (
            <Link href="/warehouse?status=low" className="block text-sm text-slate-600 hover:underline">
              Svi artikli s niskom zalihom ({count})
            </Link>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}

function RecentOrders({ own }: { own: boolean }) {
  const orders = useQuery({
    queryKey: [...queryKeys.orders.all, "recent"],
    queryFn: () => fetchRecentOrders(createClient()),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{own ? "Moje nedavne narudžbe" : "Nedavne narudžbe"}</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryState isPending={orders.isPending} error={orders.error} isEmpty={orders.data?.length === 0} emptyText="Još nema narudžbi.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {orders.data?.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 hover:bg-slate-100"
              >
                <div>
                  <p className="font-medium text-slate-900">{order.number}</p>
                  <p className="text-sm text-slate-500">{order.customer_name}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="font-medium text-slate-900">{formatMoney(order.total ?? 0)}</p>
                  {order.status && <OrderStatusBadge status={order.status} />}
                </div>
              </Link>
            ))}
          </div>
        </QueryState>
      </CardContent>
    </Card>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild className="w-full justify-between" variant="secondary">
      <Link href={href}>
        {label} <ArrowRight className="h-4 w-4" />
      </Link>
    </Button>
  );
}

function StatCard({
  title,
  value,
  hint,
  icon,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-white text-slate-900";

  return (
    <Card className={toneClass}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">{icon}</div>
        </div>
        <p className="mt-3 text-sm text-slate-500">{hint}</p>
      </CardContent>
    </Card>
  );
}
