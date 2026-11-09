import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { CustomerList } from "./customer-list";

export default function CustomersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/customers">
        <CustomerList />
      </RequireAccess>
    </Suspense>
  );
}
