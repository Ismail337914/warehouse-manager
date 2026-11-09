import { Suspense } from "react";

import { EmployeesModule } from "@/components/modules";
import { RequireAccess } from "@/server/guards";

export default function EmployeesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/employees">
        <EmployeesModule />
      </RequireAccess>
    </Suspense>
  );
}
