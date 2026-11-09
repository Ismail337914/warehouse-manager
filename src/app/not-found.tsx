import Link from "next/link";

import { Button } from "@/components/ui";

// Any URL that matches no page, and every notFound() call. Rendered inside the root layout (not the app shell),
// so it works for signed-in and signed-out visitors alike.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Greška 404</p>
        <h1 className="text-2xl font-semibold text-slate-900">Stranica ne postoji</h1>
        <p className="text-slate-600">Adresa je pogrešna ili je stranica uklonjena. Provjerite link ili se vratite na početnu.</p>
        <Button asChild>
          <Link href="/">Na početnu</Link>
        </Button>
      </div>
    </main>
  );
}
