import { loadEnvConfig } from "@next/env";

// Right after `npm run db:reset` the Supabase containers restart and PostgREST reloads its schema cache, so the
// first sign-in could fail although nothing is wrong. Wait until Auth and the REST API answer before any test.
export default async function globalSetup() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY nisu postavljeni (.env.local).");
  // The tests sell stock and change passwords: never against the cloud project.
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`E2E testovi rade samo na lokalnoj bazi, a NEXT_PUBLIC_SUPABASE_URL pokazuje na ${host}.`);
  }

  const ready = async () => {
    try {
      const [auth, rest] = await Promise.all([
        fetch(`${url}/auth/v1/health`, { headers: { apikey: key } }),
        // PostgREST answers 503 while it (re)loads its schema cache; any other answer means it is ready.
        fetch(`${url}/rest/v1/`, { headers: { apikey: key } }),
      ]);
      return auth.ok && rest.status < 500;
    } catch {
      return false;
    }
  };

  for (let attempt = 0; attempt < 60; attempt++) {
    if (await ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Lokalni Supabase nije spreman nakon 60 s. Pokrenite `npm run db:start`.");
}
