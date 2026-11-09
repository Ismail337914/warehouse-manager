import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { RequireAccess } from "@/server/guards";

import { CustomerForm } from "../customer-form";

export default function NewCustomerPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/customers/new">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Novi kupac</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Client forms render inside Suspense so Next.js can validate the page shell for instant navigation. */}
            <Suspense fallback={null}>
              <CustomerForm />
            </Suspense>
          </CardContent>
        </Card>
      </RequireAccess>
    </Suspense>
  );
}
