import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { InvoicePrint } from "./invoice-print";

export default function InvoicePrintPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/invoices/[id]/print">
        <InvoicePrint />
      </RequireAccess>
    </Suspense>
  );
}
