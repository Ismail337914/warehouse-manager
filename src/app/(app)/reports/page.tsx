import { Suspense } from "react";

import { ReportsModule } from "@/components/modules";
import { RequireAccess } from "@/server/guards";

export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/reports">
        <ReportsModule />
      </RequireAccess>
    </Suspense>
  );
}
