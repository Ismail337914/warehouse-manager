import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { InvoiceDetail } from "./invoice-detail";

export default function InvoicePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/invoices/[id]">
        <InvoiceDetail />
      </RequireAccess>
    </Suspense>
  );
}
