"use client"; // Error boundaries must be Client Components

import Link from "next/link";

import { Button } from "@/components/ui";

// Unexpected errors on a signed-in page. The app shell (menu, user) stays; only the page is replaced.
// In production the message of a server error is hidden; the digest matches the entry in the server logs.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg space-y-4 rounded-xl border border-red-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Nešto nije u redu</h2>
      <p className="text-sm text-slate-600">
        Stranica se nije mogla prikazati. Pokušajte ponovo; ako se greška ponavlja, javite administratoru
        {error.digest ? <> i navedite oznaku <span className="font-mono">{error.digest}</span></> : null}.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => retry()}>Pokušaj ponovo</Button>
        <Button asChild variant="outline">
          <Link href="/">Na početnu</Link>
        </Button>
      </div>
    </div>
  );
}
