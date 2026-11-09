import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { ProductDetail } from "./product-detail";

export default function ProductPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/warehouse/[id]">
        <ProductDetail />
      </RequireAccess>
    </Suspense>
  );
}
