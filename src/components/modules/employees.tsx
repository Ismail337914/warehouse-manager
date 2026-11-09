import Link from "next/link";
import { Users } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { can, roleLabels } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";

// The people who work in the app: every user account with its role and status, from
// public.employee_directory() (admins and managers only; the page is guarded too).
// Accounts and roles are managed by admins (Postavke → Korisnici).
export async function EmployeesModule() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: employees, error } = await supabase.rpc("employee_directory");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Zaposlenici</CardTitle>
          {can(user.role, "users.manage_roles") && (
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/users">
                <Users className="h-4 w-4" />
                Korisnički računi i uloge
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="py-6 text-center text-sm text-red-600">Zaposlenici nisu učitani.</p>
        ) : employees.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nema korisnika.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ime i prezime</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Uloga</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium text-slate-900">{employee.full_name || "—"}</TableCell>
                  <TableCell className="text-slate-600">{employee.email}</TableCell>
                  <TableCell>{roleLabels[employee.role]}</TableCell>
                  <TableCell>
                    <Badge variant={employee.is_active ? "success" : "secondary"}>
                      {employee.is_active ? "Aktivan" : "Deaktiviran"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
