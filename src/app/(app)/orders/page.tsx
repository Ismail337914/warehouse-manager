import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { OrderList } from "./order-list";

export default function OrdersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/orders">
        <OrderList />
      </RequireAccess>
    </Suspense>
  );
}
