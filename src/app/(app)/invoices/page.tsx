import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { InvoiceList } from "./invoice-list";

export default function InvoicesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/invoices">
        <InvoiceList />
      </RequireAccess>
    </Suspense>
  );
}
