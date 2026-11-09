import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { RequireAccess } from "@/server/guards";

import { OrderForm } from "../order-form";

export default function NewOrderPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/orders/new">
        <Card className="max-w-5xl">
          <CardHeader>
            <CardTitle>Nova narudžba</CardTitle>
            <CardDescription>Nacrt ne rezerviše robu; rezervacija nastaje tek kad potvrdite narudžbu.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Client forms render inside Suspense so Next.js can validate the page shell for instant navigation. */}
            <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
              <OrderForm />
            </Suspense>
          </CardContent>
        </Card>
      </RequireAccess>
    </Suspense>
  );
}
