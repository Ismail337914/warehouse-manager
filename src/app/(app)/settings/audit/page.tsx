import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { AuditLogList } from "./audit-log-list";

export default function AuditLogPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/settings/audit">
        <AuditLogList />
      </RequireAccess>
    </Suspense>
  );
}
