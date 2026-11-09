"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormMessage,
  Input,
  Label,
  NativeSelect,
  PasswordInput,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type Feedback,
} from "@/components/ui";
import { appRoles, roleLabels, type AppRole } from "@/lib/permissions";
import { createUserSchema, type CreateUserFormValues } from "@/lib/schemas";
import { createUser, setUserActive, updateUserRole } from "@/server/actions/users";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  is_active: boolean;
};

export function UsersTable({ profiles, currentUserId }: { profiles: Profile[]; currentUserId: string }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    startTransition(async () => {
      const result = await action();
      setFeedback(result.ok ? { tone: "info", text: success } : { tone: "error", text: result.error ?? "Greška." });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Korisnici</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormMessage tone={feedback?.tone}>{feedback?.text}</FormMessage>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Korisnik</TableHead>
              <TableHead>Uloga</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => {
              const isSelf = profile.id === currentUserId;
              return (
                <TableRow key={profile.id}>
                  <TableCell>
                    <p className="font-medium text-slate-900">{profile.full_name || "—"}</p>
                    <p className="text-xs text-slate-500">{profile.email}</p>
                  </TableCell>
                  <TableCell>
                    <NativeSelect
                      aria-label={`Uloga za ${profile.email}`}
                      className="md:w-40"
                      value={profile.role}
                      disabled={isSelf || isPending}
                      onChange={(event) =>
                        run(() => updateUserRole(profile.id, event.target.value as AppRole), "Uloga je promijenjena.")
                      }
                    >
                      {appRoles.map((role) => (
                        <option key={role} value={role}>{roleLabels[role]}</option>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.is_active ? "success" : "secondary"}>
                      {profile.is_active ? "Aktivan" : "Deaktiviran"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {!isSelf && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() =>
                          run(
                            () => setUserActive(profile.id, !profile.is_active),
                            profile.is_active ? "Korisnik je deaktiviran." : "Korisnik je aktiviran.",
                          )
                        }
                      >
                        {profile.is_active ? "Deaktiviraj" : "Aktiviraj"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const emptyUser: CreateUserFormValues = { fullName: "", email: "", role: "prodavac", password: "" };

export function CreateUserForm() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: emptyUser,
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await createUser(values);
    if (!result.ok) {
      setFeedback({ tone: "error", text: result.error });
      return;
    }
    reset(emptyUser);
    setFeedback({ tone: "info", text: `Korisnik ${values.email} je kreiran.` });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novi korisnik</CardTitle>
      </CardHeader>
      <CardContent>
        {/* method="post": if submitted before React loads, the browser must not put the password in the URL. */}
        <form method="post" className="space-y-3" onSubmit={onSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="user-name">Ime i prezime</Label>
            <Input id="user-name" aria-invalid={Boolean(errors.fullName)} {...register("fullName")} />
            <FormMessage className="text-xs">{errors.fullName?.message}</FormMessage>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">E-mail</Label>
            <Input id="user-email" type="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
            <FormMessage className="text-xs">{errors.email?.message}</FormMessage>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role">Uloga</Label>
            <NativeSelect id="user-role" {...register("role")}>
              {appRoles.map((role) => (
                <option key={role} value={role}>{roleLabels[role]}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">Početna lozinka</Label>
            <PasswordInput id="user-password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
            <FormMessage className="text-xs">{errors.password?.message}</FormMessage>
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Kreiranje..." : "Kreiraj korisnika"}
          </Button>
          <FormMessage tone={feedback?.tone}>{feedback?.text}</FormMessage>
        </form>
      </CardContent>
    </Card>
  );
}
