import { Suspense } from "react";

import { RequireAccess } from "@/server/guards";

import { ReservationList } from "./reservation-list";

export default function ReservationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/reservations">
        <ReservationList />
      </RequireAccess>
    </Suspense>
  );
}
