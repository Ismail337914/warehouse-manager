import { Suspense } from "react";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth";
import { RequireAccess } from "@/server/guards";

import { CreateUserForm, UsersTable } from "./users-manager";

export default function UsersPage() {
  return (
    // Reads the session, so it streams in behind its own boundary (Cache Components).
    <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje korisnika...</p>}>
      <RequireAccess route="/settings/users">
        <UsersContent />
      </RequireAccess>
    </Suspense>
  );
}

async function UsersContent() {
  // Admin data must always be current, so this renders at request time instead of the prefetched shell.
  await connection();
  // RequireAccess has already allowed only admins; the user is needed for their own id.
  const user = await requireUser();

  // Runs as the admin: the profiles RLS policy returns every profile only to admins.
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .order("full_name");

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
      {error ? (
        <p className="text-sm text-red-600">Korisnici nisu učitani. Osvježite stranicu.</p>
      ) : (
        <UsersTable profiles={profiles} currentUserId={user.id} />
      )}
      <CreateUserForm />
    </div>
  );
}
