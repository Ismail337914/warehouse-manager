import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { CustomerDetail } from "./customer-detail";

export default function CustomerPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/customers/[id]">
        <CustomerDetail />
      </RequireAccess>
    </Suspense>
  );
}
