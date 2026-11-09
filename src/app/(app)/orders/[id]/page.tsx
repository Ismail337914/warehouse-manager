import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { OrderDetail } from "./order-detail";

export default function OrderPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/orders/[id]">
        <OrderDetail />
      </RequireAccess>
    </Suspense>
  );
}
