import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { SalesDetails } from "./sales-details";

export default function SalesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/sales">
        <SalesDetails />
      </RequireAccess>
    </Suspense>
  );
}
