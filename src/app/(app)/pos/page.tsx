import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { PosTerminal } from "./pos-terminal";

export default function PosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/pos">
        <PosTerminal />
      </RequireAccess>
    </Suspense>
  );
}
