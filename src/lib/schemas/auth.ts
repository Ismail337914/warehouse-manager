import { z } from "zod";

// Same rule as supabase/config.toml: at least 8 characters, letters and digits.
export const password = z
  .string()
  .min(8, "Lozinka mora imati najmanje 8 znakova.")
  .regex(/[A-Za-z]/, "Lozinka mora sadržavati slovo.")
  .regex(/\d/, "Lozinka mora sadržavati broj.");

export const email = z.email("Neispravna e-mail adresa.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Unesite lozinku."),
});

export const forgotPasswordSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Lozinke se ne podudaraju.",
    path: ["confirmPassword"],
  });

// A signed-in user changing their password: the current one proves it is really them.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Unesite trenutnu lozinku."),
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Lozinke se ne podudaraju.",
    path: ["confirmPassword"],
  })
  .refine((values) => values.password !== values.currentPassword, {
    message: "Nova lozinka mora biti različita od trenutne.",
    path: ["password"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
