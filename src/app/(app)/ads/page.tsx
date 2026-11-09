import { Suspense } from "react";

import { OmnichannelModule } from "@/components/modules";
import { RequireAccess } from "@/server/guards";

export default function AdsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/ads">
        <OmnichannelModule />
      </RequireAccess>
    </Suspense>
  );
}
