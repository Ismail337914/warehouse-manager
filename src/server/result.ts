import type { z } from "zod";

// What every Server Action returns. Errors are user-facing messages in Bosnian.
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

// Zod errors as the first message plus one message per field ("items.0.quantity"), for errors next to fields.
export function invalidInput(error: z.ZodError): { ok: false; error: string; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !(path in fieldErrors)) fieldErrors[path] = issue.message;
  }
  return { ok: false, error: error.issues[0]?.message ?? "Podaci nisu ispravni.", fieldErrors };
}
