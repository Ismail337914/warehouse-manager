"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button, FormMessage, Label, PasswordInput } from "@/components/ui";
import { updatePasswordSchema, type UpdatePasswordFormValues } from "@/lib/schemas";
import { updatePassword } from "@/server/actions/auth";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    const result = await updatePassword(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Same session as before (from the reset link), so a client-side navigation is enough.
    router.replace("/");
  });

  // method="post": if the form is submitted before React loads, the browser must not put the password in the URL.
  return (
    <form method="post" className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="new-password">Nova lozinka</Label>
        <PasswordInput id="new-password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
        <FormMessage className="text-xs">{errors.password?.message}</FormMessage>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Ponovite lozinku</Label>
        <PasswordInput id="confirm-password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register("confirmPassword")} />
        <FormMessage className="text-xs">{errors.confirmPassword?.message}</FormMessage>
      </div>
      <FormMessage>{error}</FormMessage>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Spremanje..." : "Spremi lozinku"}
      </Button>
    </form>
  );
}
