import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { ProductList } from "./product-list";

export default function WarehousePage() {
  return (
    // The list reads filters from the URL, so it renders inside Suspense (Cache Components).
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/warehouse">
        <ProductList />
      </RequireAccess>
    </Suspense>
  );
}
