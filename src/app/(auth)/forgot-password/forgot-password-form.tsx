"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button, FormMessage, Input, Label } from "@/components/ui";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/schemas";
import { requestPasswordReset } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    const result = await requestPasswordReset(values);
    if (result.ok) setSent(true);
    else setError(result.error);
  });

  if (sent) {
    return (
      <FormMessage tone="info">
        Ako nalog s tom adresom postoji, poslali smo e-mail s linkom. Link važi jedan sat.
      </FormMessage>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="reset-email">E-mail</Label>
        <Input id="reset-email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
        <FormMessage className="text-xs">{errors.email?.message}</FormMessage>
      </div>
      <FormMessage>{error}</FormMessage>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Slanje..." : "Pošalji link"}
      </Button>
    </form>
  );
}
