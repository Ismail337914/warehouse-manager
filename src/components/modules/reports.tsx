"use client";

import { useQuery } from "@tanstack/react-query";

import { QueryState } from "@/components/list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { fetchDashboardSummary } from "@/lib/queries/dashboard";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/utils";

export function ReportsModule() {
  const summary = useQuery({
    queryKey: [...queryKeys.dashboard.all, "summary"],
    queryFn: () => fetchDashboardSummary(createClient()),
  });

  return (
    <QueryState isPending={summary.isPending} error={summary.error}>
      {summary.data && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Promet ovaj mjesec</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">{formatMoney(summary.data.revenue_month)}</p>
              <p className="mt-2 text-sm text-slate-500">POS prodaje i fakture narudžbi s PDV-om, umanjeno za storno.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Zalihe</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">{summary.data.low_stock_count}</p>
              <p className="mt-2 text-sm text-slate-500">Aktivni proizvodi na ili ispod minimalne zalihe.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Otvorene narudžbe</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">{summary.data.open_orders}</p>
              <p className="mt-2 text-sm text-slate-500">Narudžbe u nacrtu i potvrđene, još neisporučene.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </QueryState>
  );
}
