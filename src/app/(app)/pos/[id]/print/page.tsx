import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { ReceiptPrint } from "./receipt-print";

export default function PosReceiptPrintPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/pos/[id]/print">
        <ReceiptPrint />
      </RequireAccess>
    </Suspense>
  );
}
