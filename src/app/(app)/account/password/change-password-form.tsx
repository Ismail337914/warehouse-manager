"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button, FormMessage, Input, Label } from "@/components/ui";
import { changePasswordSchema, type ChangePasswordFormValues } from "@/lib/schemas";
import { applyFieldErrors } from "@/lib/use-action";
import { changePassword } from "@/server/actions/auth";

const emptyValues: ChangePasswordFormValues = { currentPassword: "", password: "", confirmPassword: "" };

export function ChangePasswordForm() {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: emptyValues });

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    setSaved(false);
    const result = await changePassword(values);
    if (!result.ok) {
      setError(result.error);
      applyFieldErrors(setFieldError, result.fieldErrors);
      return;
    }
    reset(emptyValues);
    setSaved(true);
  });

  const field = (name: keyof ChangePasswordFormValues, label: string, autoComplete: string) => (
    <div className="space-y-2">
      <Label htmlFor={`account-${name}`}>{label}</Label>
      <Input
        id={`account-${name}`}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={Boolean(errors[name])}
        {...register(name)}
      />
      <FormMessage className="text-xs">{errors[name]?.message}</FormMessage>
    </div>
  );

  // method="post": if the form is submitted before React loads, the browser must not put the passwords in the URL.
  return (
    <form method="post" className="space-y-4" onSubmit={onSubmit} noValidate>
      {field("currentPassword", "Trenutna lozinka", "current-password")}
      {field("password", "Nova lozinka", "new-password")}
      {field("confirmPassword", "Ponovite novu lozinku", "new-password")}
      <FormMessage>{error}</FormMessage>
      {saved && <FormMessage tone="info">Lozinka je promijenjena.</FormMessage>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Spremanje..." : "Promijeni lozinku"}
      </Button>
    </form>
  );
}
