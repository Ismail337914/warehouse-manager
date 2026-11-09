import { Suspense } from "react";
import Link from "next/link";

import { AuthCard } from "@/components/auth-card";

import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <AuthCard title="Prijava" description="Prijavite se svojim poslovnim e-mailom i lozinkom.">
      <div className="space-y-4">
        {/* The form reads ?next= and ?error= from the URL, so it renders inside Suspense. */}
        <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>
          <LoginForm />
        </Suspense>
        <Link href="/forgot-password" className="block text-center text-sm text-slate-600 hover:text-slate-900">
          Zaboravljena lozinka?
        </Link>
      </div>
    </AuthCard>
  );
}
