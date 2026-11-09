import { Suspense } from "react";
import Link from "next/link";
import { ScrollText, Users } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth";
import { RequireAccess } from "@/server/guards";

import { CompanySettings } from "./company-settings";

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
      <RequireAccess route="/settings">
        <div className="space-y-6">
          <CompanySettings />
          <UsersCard />
          <AuditCard />
        </div>
      </RequireAccess>
    </Suspense>
  );
}

async function UsersCard() {
  const user = await requireUser();
  if (!can(user.role, "users.manage_roles")) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Korisnici i uloge</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">Dodajte korisnike, dodijelite uloge i deaktivirajte naloge.</p>
        <Button asChild variant="secondary">
          <Link href="/settings/users">
            <Users className="h-4 w-4" />
            Upravljaj korisnicima
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

async function AuditCard() {
  const user = await requireUser();
  if (!can(user.role, "audit_logs.read")) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">Ko je mijenjao uloge, postavke, cijene i zalihe, ko je stornirao i evidentirao uplate.</p>
        <Button asChild variant="secondary">
          <Link href="/settings/audit">
            <ScrollText className="h-4 w-4" />
            Otvori audit log
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
