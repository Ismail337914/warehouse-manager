import { Suspense } from "react";

import { AuthCard } from "@/components/auth-card";

import { UpdatePasswordForm } from "./update-password-form";

export default function UpdatePasswordPage() {
  return (
    <AuthCard title="Nova lozinka" description="Najmanje 8 znakova, sa slovima i brojevima.">
      {/* Client forms render inside Suspense so Next.js can validate the page shell for instant navigation. */}
      <Suspense fallback={null}>
        <UpdatePasswordForm />
      </Suspense>
    </AuthCard>
  );
}
