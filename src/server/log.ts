// Server-side error log. On Vercel everything written to the console ends up in the project's logs
// (Deployments → Logs), so a failed database call can be traced without showing details to the user.
// Only technical fields are logged, never form input, passwords or tokens. PostgreSQL's `details` is left out
// on purpose: for constraint errors it repeats the whole row ("Failing row contains (…)"), i.e. customer data.

type LoggableError = { code?: string; message?: string; hint?: string | null };

export function logServerError(scope: string, error: unknown) {
  const value: LoggableError =
    error && typeof error === "object" ? (error as LoggableError) : { message: String(error) };
  console.error(
    JSON.stringify({
      level: "error",
      scope,
      code: value.code ?? null,
      message: value.message ?? null,
      hint: value.hint ?? null,
    }),
  );
}
