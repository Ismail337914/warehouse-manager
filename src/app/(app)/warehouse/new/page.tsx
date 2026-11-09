import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { NewProduct } from "./new-product";

export default function NewProductPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/warehouse/new">
        <NewProduct />
      </RequireAccess>
    </Suspense>
  );
}
