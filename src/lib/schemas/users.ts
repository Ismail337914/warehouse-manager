import { z } from "zod";

import { email, password } from "./auth";
import { requiredText } from "./common";

export const appRoleSchema = z.enum(["admin", "menadzer", "prodavac"], { error: "Odaberite ulogu." });

export const createUserSchema = z.object({
  fullName: requiredText("Ime i prezime je obavezno."),
  email,
  role: appRoleSchema,
  password,
});

export const updateUserRoleSchema = z.object({
  userId: z.uuid(),
  role: appRoleSchema,
});

export const setUserActiveSchema = z.object({
  userId: z.uuid(),
  isActive: z.boolean(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
