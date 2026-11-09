import { Suspense } from "react";

import { DashboardPage } from "@/components/dashboard";
import { RequireAccess } from "@/server/guards";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/">
        <DashboardPage />
      </RequireAccess>
    </Suspense>
  );
}
