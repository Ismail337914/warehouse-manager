import { Suspense } from "react";
import Link from "next/link";

import { AuthCard } from "@/components/auth-card";

import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Zaboravljena lozinka" description="Poslaćemo vam link za postavljanje nove lozinke.">
      {/* Client forms render inside Suspense so Next.js can validate the page shell for instant navigation. */}
      <Suspense fallback={null}>
        <ForgotPasswordForm />
      </Suspense>
      <Link href="/login" className="mt-4 block text-center text-sm text-slate-600 hover:text-slate-900">
        Nazad na prijavu
      </Link>
    </AuthCard>
  );
}
