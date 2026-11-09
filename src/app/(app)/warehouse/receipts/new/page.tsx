import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { ReceiptForm } from "./receipt-form";

export default function NewReceiptPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/warehouse/receipts/new">
        <ReceiptForm />
      </RequireAccess>
    </Suspense>
  );
}
