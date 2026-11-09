import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { CategoryManager } from "./category-manager";

export default function CategoriesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/warehouse/categories">
        <CategoryManager />
      </RequireAccess>
    </Suspense>
  );
}
