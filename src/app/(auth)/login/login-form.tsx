"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button, FormMessage, Input, Label, PasswordInput } from "@/components/ui";
import { loginSchema, type LoginFormValues } from "@/lib/schemas";
import { signIn } from "@/server/actions/auth";

const linkErrors: Record<string, string> = {
  link: "Link je istekao ili je već iskorišten. Zatražite novi.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState(linkErrors[searchParams.get("error") ?? ""] ?? "");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    const result = await signIn(values, searchParams.get("next") ?? undefined);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Full page load, not a client-side navigation: nothing rendered before login (signed out) is reused.
    window.location.assign(result.data.redirectTo);
  });

  // method="post": if the form is submitted before React loads, the browser must not put the password in the URL.
  return (
    <form method="post" className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <Label htmlFor="login-email">E-mail</Label>
        <Input id="login-email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
        <FormMessage className="text-xs">{errors.email?.message}</FormMessage>
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Lozinka</Label>
        <PasswordInput id="login-password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
        <FormMessage className="text-xs">{errors.password?.message}</FormMessage>
      </div>
      <FormMessage>{error}</FormMessage>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Prijava..." : "Prijavi se"}
      </Button>
    </form>
  );
}
