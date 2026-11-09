"use client"; // Error boundaries must be Client Components

import "./globals.css";

// Last resort when the root layout itself fails. It replaces the root layout, so it renders its own
// <html> and <body> and imports the global styles itself. Metadata exports aren't supported here: <title> instead.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="bs">
      <body className="min-h-screen bg-slate-100 text-slate-900">
        <title>Greška · Warehouse Manager</title>
        <main className="flex min-h-screen items-center justify-center px-4">
          <div role="alert" className="max-w-md space-y-4 text-center">
            <h1 className="text-2xl font-semibold">Aplikacija se nije mogla učitati</h1>
            <p className="text-slate-600">
              Pokušajte ponovo za nekoliko trenutaka.
              {error.digest ? <> Oznaka greške: <span className="font-mono">{error.digest}</span>.</> : null}
            </p>
            <button
              type="button"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              onClick={() => retry()}
            >
              Pokušaj ponovo
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
