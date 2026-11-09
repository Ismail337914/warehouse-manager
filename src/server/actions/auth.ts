"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeRedirectPath } from "@/lib/safe-redirect";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  updatePasswordSchema,
  type ChangePasswordFormValues,
  type ForgotPasswordFormValues,
  type LoginFormValues,
  type UpdatePasswordFormValues,
} from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/server/auth";
import { logServerError } from "@/server/log";
import { invalidInput, type ActionResult } from "@/server/result";

const DEACTIVATED_MESSAGE = "Nalog je deaktiviran. Obratite se administratoru.";
const TOO_MANY_ATTEMPTS = "Previše pokušaja. Pokušajte ponovo za 15 minuta.";

// ---------------------------------------------------------------------------
// Attempt counter (public.auth_attempt_allowed / record_auth_attempt, callable only with the service role)
// ---------------------------------------------------------------------------
// Supabase Auth limits requests per IP, but sign-in runs on the server, so all users share the server's IP.
// This counter limits failed sign-ins per e-mail and per client IP. It stores only hashes, never the
// address or IP. On Vercel x-forwarded-for is set by the platform; elsewhere the per-e-mail limit still holds.

type AttemptKind = "login" | "reset";
type AttemptKeys = { p_email_key: string; p_ip_key: string };

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function attemptKeys(email: string): Promise<AttemptKeys> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return { p_email_key: hash(email.trim().toLowerCase()), p_ip_key: hash(ip) };
}

// A second line of defence: if the counter can't be read, the request is not blocked (Supabase's own limits
// still apply), so a database hiccup never locks everyone out.
async function attemptAllowed(kind: AttemptKind, keys: AttemptKeys) {
  try {
    const { data, error } = await createAdminClient().rpc("auth_attempt_allowed", { p_kind: kind, ...keys });
    return error ? true : data !== false;
  } catch {
    return true;
  }
}

async function recordAttempt(kind: AttemptKind, keys: AttemptKeys) {
  try {
    await createAdminClient().rpc("record_auth_attempt", { p_kind: kind, ...keys });
  } catch {
    // Not recording one attempt is acceptable; see attemptAllowed.
  }
}

async function clearAttempts(kind: AttemptKind, keys: AttemptKeys) {
  try {
    await createAdminClient().rpc("clear_auth_attempts", { p_kind: kind, p_email_key: keys.p_email_key });
  } catch {
    // The failures simply expire after 15 minutes.
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

// Returns where to go instead of redirecting: the browser then loads that page with a full navigation, so the
// first request after login already carries the new session cookies.
export async function signIn(values: LoginFormValues, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Unesite e-mail i lozinku." };

  const keys = await attemptKeys(parsed.data.email);
  if (!(await attemptAllowed("login", keys))) return { ok: false, error: TOO_MANY_ATTEMPTS };

  // The password goes to Supabase Auth as is: it is never part of an SQL statement, so special characters are fine.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // Deactivated users are banned in Supabase Auth (see setUserActive), so the sign-in itself fails.
  if (error?.code === "user_banned") return { ok: false, error: DEACTIVATED_MESSAGE };
  if (error?.status === 429) return { ok: false, error: TOO_MANY_ATTEMPTS };
  if (error || !data.user) {
    await recordAttempt("login", keys);
    // Same message for a wrong e-mail and a wrong password, so the form doesn't reveal which accounts exist.
    return { ok: false, error: "Pogrešan e-mail ili lozinka." };
  }
  await clearAttempts("login", keys);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  // A failed read (database restarting, network) is not a deactivated account: say so, and let the user retry.
  if (profileError) {
    logServerError("auth.profile", profileError);
    await supabase.auth.signOut();
    return { ok: false, error: "Prijava trenutno nije moguća. Pokušajte ponovo za nekoliko sekundi." };
  }
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { ok: false, error: DEACTIVATED_MESSAGE };
  }

  return { ok: true, data: { redirectTo: safeRedirectPath(next) } };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(values: ForgotPasswordFormValues): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Neispravna e-mail adresa." };

  // Every request counts, so the form can't be used to flood an inbox. The limit does not depend on whether the
  // account exists, so it reveals nothing.
  const keys = await attemptKeys(parsed.data.email);
  if (!(await attemptAllowed("reset", keys))) return { ok: false, error: TOO_MANY_ATTEMPTS };
  await recordAttempt("reset", keys);

  const supabase = await createClient();
  // Supabase sends the link only to redirect URLs allowed in its Auth settings, so a forged Origin goes nowhere.
  const origin = (await headers()).get("origin") ?? undefined;
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: origin ? `${origin}/auth/confirm?next=/update-password` : undefined,
  });

  // Always the same answer, whether or not the account exists.
  return { ok: true, data: null };
}

// A session opened by an e-mail link carries that method in its authentication methods (amr): "recovery" for the
// reset link ("otp"/"magiclink" for other e-mailed one-time links, which equally prove access to the mailbox).
// Only such a session, and only for as long as the link itself is valid (otp_expiry, 1 hour), may set a new
// password without the current one; a session that signed in with a password must use changePassword.
const RESET_METHODS = new Set(["recovery", "otp", "magiclink"]);
const RESET_WINDOW_SECONDS = 60 * 60;

function openedByResetLink(amr: unknown) {
  if (!Array.isArray(amr)) return false;
  const now = Date.now() / 1000;
  return amr.some((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return false;
    const { method, timestamp } = entry as { method?: unknown; timestamp?: unknown };
    return RESET_METHODS.has(String(method)) && now - Number(timestamp) <= RESET_WINDOW_SECONDS;
  });
}

// Returns instead of redirecting, for the same reason as signIn: the form then loads the app with a full navigation.
export async function updatePassword(values: UpdatePasswordFormValues): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Neispravna lozinka." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return { ok: false, error: "Link za reset je istekao. Zatražite novi." };
  // Without this, anyone at a computer where someone is signed in could set a new password here.
  if (!openedByResetLink(claims.claims.amr)) {
    return {
      ok: false,
      error: "Ovdje se lozinka mijenja samo preko linka iz e-maila. Prijavljeni korisnik je mijenja preko ikone ključa u zaglavlju.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error?.code === "same_password") return { ok: false, error: "Nova lozinka mora biti različita od stare." };
  if (error?.code === "weak_password") return { ok: false, error: "Lozinka je preslaba. Koristite najmanje 8 znakova, slova i brojeve." };
  if (error) return { ok: false, error: "Lozinka nije promijenjena. Pokušajte ponovo." };

  // Whoever knew the old password is signed out on every other device.
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true, data: null };
}

// Password change for a signed-in user (Postavke računa). The current password is checked first, with the same
// attempt limit as sign-in, so a session left open on a shared computer can't be used to take over the account.
// Signing in again also gives a fresh session, which Supabase requires for a password change
// (secure_password_change). Other devices are signed out afterwards.
export async function changePassword(values: ChangePasswordFormValues): Promise<ActionResult> {
  const auth = await authorize("account.manage");
  if (!auth.ok) return auth;

  const parsed = changePasswordSchema.safeParse(values);
  if (!parsed.success) return invalidInput(parsed.error);

  const keys = await attemptKeys(auth.user.email);
  if (!(await attemptAllowed("login", keys))) return { ok: false, error: TOO_MANY_ATTEMPTS };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: parsed.data.currentPassword,
  });
  if (signInError?.status === 429) return { ok: false, error: TOO_MANY_ATTEMPTS };
  if (signInError) {
    await recordAttempt("login", keys);
    return { ok: false, error: "Trenutna lozinka nije tačna.", fieldErrors: { currentPassword: "Trenutna lozinka nije tačna." } };
  }
  await clearAttempts("login", keys);

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error?.code === "same_password") {
    return { ok: false, error: "Nova lozinka mora biti različita od trenutne.", fieldErrors: { password: "Nova lozinka mora biti različita od trenutne." } };
  }
  if (error?.code === "weak_password") return { ok: false, error: "Lozinka je preslaba. Koristite najmanje 8 znakova, slova i brojeve." };
  if (error) return { ok: false, error: "Lozinka nije promijenjena. Pokušajte ponovo." };

  await supabase.auth.signOut({ scope: "others" });
  return { ok: true, data: null };
}
