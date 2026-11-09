import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { StockForms } from "./stock-forms";

export default function StockAdjustmentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/warehouse/adjustments/new">
        <StockForms />
      </RequireAccess>
    </Suspense>
  );
}
