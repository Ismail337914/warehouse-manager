"use server";

import { refresh } from "next/cache";

import {
  createUserSchema,
  setUserActiveSchema,
  updateUserRoleSchema,
  type CreateUserFormValues,
} from "@/lib/schemas";
import type { AppRole } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/server/auth";
import type { ActionResult } from "@/server/result";

// Deactivated users are also banned in Supabase Auth, so they can't sign in or refresh a session.
const BAN_FOREVER = "876000h";

export async function createUser(values: CreateUserFormValues): Promise<ActionResult> {
  const auth = await authorize("users.manage_roles");
  if (!auth.ok) return auth;

  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravni podaci." };

  const { email, password, fullName, role } = parsed.data;
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // app_metadata is writable only with the service role; the profile trigger reads the role from it.
    app_metadata: { role },
    user_metadata: { full_name: fullName },
  });

  if (error) {
    const exists = error.code === "email_exists" || error.status === 422;
    return { ok: false, error: exists ? "Korisnik s ovim e-mailom već postoji." : "Korisnik nije kreiran." };
  }

  refresh();
  return { ok: true, data: null };
}

export async function updateUserRole(userId: string, role: AppRole): Promise<ActionResult> {
  const auth = await authorize("users.manage_roles");
  if (!auth.ok) return auth;

  const parsed = updateUserRoleSchema.safeParse({ userId, role });
  if (!parsed.success) return { ok: false, error: "Neispravni podaci." };
  if (parsed.data.userId === auth.user.id) return { ok: false, error: "Ne možete mijenjati vlastitu ulogu." };

  // Runs as the admin, so the "Admins update profiles" policy and the self-change trigger apply too.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.userId)
    .select("id");
  if (error || data.length === 0) return { ok: false, error: "Uloga nije promijenjena." };

  refresh();
  return { ok: true, data: null };
}

export async function setUserActive(userId: string, isActive: boolean): Promise<ActionResult> {
  const auth = await authorize("users.manage_roles");
  if (!auth.ok) return auth;

  const parsed = setUserActiveSchema.safeParse({ userId, isActive });
  if (!parsed.success) return { ok: false, error: "Neispravni podaci." };
  if (parsed.data.userId === auth.user.id) return { ok: false, error: "Ne možete deaktivirati vlastiti nalog." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.userId)
    .select("id");
  if (error || data.length === 0) return { ok: false, error: "Status nije promijenjen." };

  const { error: banError } = await createAdminClient().auth.admin.updateUserById(parsed.data.userId, {
    ban_duration: parsed.data.isActive ? "none" : BAN_FOREVER,
  });
  if (banError) return { ok: false, error: "Status je spremljen, ali prijava nije blokirana. Pokušajte ponovo." };

  refresh();
  return { ok: true, data: null };
}
