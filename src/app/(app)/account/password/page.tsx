import { Suspense } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { RequireAccess } from "@/server/guards";

import { ChangePasswordForm } from "./change-password-form";

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/account/password">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Promjena lozinke</CardTitle>
            <CardDescription>Najmanje 8 znakova, sa slovima i brojevima. Ostali uređaji se nakon promjene odjavljuju.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </RequireAccess>
    </Suspense>
  );
}
