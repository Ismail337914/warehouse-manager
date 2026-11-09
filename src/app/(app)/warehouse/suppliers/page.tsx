import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { SupplierManager } from "./supplier-manager";

export default function SuppliersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/warehouse/suppliers">
        <SupplierManager />
      </RequireAccess>
    </Suspense>
  );
}
