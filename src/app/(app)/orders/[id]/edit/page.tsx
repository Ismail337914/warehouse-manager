import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { EditOrder } from "./edit-order";

export default function EditOrderPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/orders/[id]/edit">
        <EditOrder />
      </RequireAccess>
    </Suspense>
  );
}
