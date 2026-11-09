"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";

import { QueryState } from "@/components/list";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormMessage,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  type Feedback,
} from "@/components/ui";
import { fetchSupplierList, type SupplierListRow } from "@/lib/queries/products";
import { invalidates, queryKeys } from "@/lib/query-keys";
import { supplierInputSchema, type SupplierInput } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/client";
import { applyFieldErrors, useAction } from "@/lib/use-action";
import { createSupplier, deleteSupplier, updateSupplier } from "@/server/actions/suppliers";

const emptySupplier: SupplierInput = { name: "", jib: "", pdvNumber: "", address: "", city: "", phone: "", email: "", note: "" };

const toFormValues = (supplier: SupplierListRow): SupplierInput => ({
  name: supplier.name,
  jib: supplier.jib ?? "",
  pdvNumber: supplier.pdv_number ?? "",
  address: supplier.address,
  city: supplier.city,
  phone: supplier.phone,
  email: supplier.email ?? "",
  note: supplier.note,
});

// The page is guarded on the server (RequireAccess, "suppliers.manage"); RLS allows the same roles.
export function SupplierManager() {
  const suppliers = useQuery({ queryKey: queryKeys.suppliers.list, queryFn: () => fetchSupplierList(createClient()) });
  const [editing, setEditing] = useState<SupplierListRow | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  return (
    <div className="space-y-6">
      <Link href="/warehouse" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Nazad na lager
      </Link>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>Dobavljači</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormMessage tone={feedback?.tone}>{feedback?.text}</FormMessage>
            <QueryState
              isPending={suppliers.isPending}
              error={suppliers.error}
              isEmpty={suppliers.data?.length === 0}
              emptyText="Još nema dobavljača. Dodajte prvog u formi."
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naziv</TableHead>
                    <TableHead>JIB / PDV broj</TableHead>
                    <TableHead>Mjesto</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.data?.map((supplier) => (
                    <SupplierRow
                      key={supplier.id}
                      supplier={supplier}
                      onEdit={() => {
                        setFeedback(null);
                        setEditing(supplier);
                      }}
                      onDeleted={() => {
                        if (editing?.id === supplier.id) setEditing(null);
                        setFeedback({ tone: "info", text: `Dobavljač ${supplier.name} je obrisan.` });
                      }}
                      onError={(text) => setFeedback({ tone: "error", text })}
                    />
                  ))}
                </TableBody>
              </Table>
            </QueryState>
          </CardContent>
        </Card>

        {/* key: a new form (with its own default values) for each supplier being edited. */}
        <SupplierForm key={editing?.id ?? "new"} supplier={editing} onDone={() => setEditing(null)} />
      </div>
    </div>
  );
}

function SupplierRow({
  supplier,
  onEdit,
  onDeleted,
  onError,
}: {
  supplier: SupplierListRow;
  onEdit: () => void;
  onDeleted: () => void;
  onError: (text: string) => void;
}) {
  const remove = useAction(deleteSupplier, invalidates.supplier);
  const [confirming, setConfirming] = useState(false);

  const onDelete = async () => {
    const result = await remove.mutateAsync(supplier.id);
    setConfirming(false);
    if (!result.ok) onError(result.error);
    else onDeleted();
  };

  return (
    <TableRow>
      <TableCell className="font-medium text-slate-900">{supplier.name}</TableCell>
      <TableCell className="text-slate-600">
        {[supplier.jib, supplier.pdv_number].filter(Boolean).join(" / ") || "—"}
      </TableCell>
      <TableCell className="text-slate-600">{[supplier.address, supplier.city].filter(Boolean).join(", ") || "—"}</TableCell>
      <TableCell className="text-slate-600">{[supplier.phone, supplier.email].filter(Boolean).join(" · ") || "—"}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            Uredi
          </Button>
          {confirming ? (
            <>
              <Button size="sm" variant="danger" disabled={remove.isPending} onClick={onDelete}>
                Potvrdi brisanje
              </Button>
              <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => setConfirming(false)}>
                Ne
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => setConfirming(true)}>
              Obriši
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function SupplierForm({ supplier, onDone }: { supplier: SupplierListRow | null; onDone: () => void }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const save = useAction(
    (values: SupplierInput) => (supplier ? updateSupplier(supplier.id, values) : createSupplier(values)),
    invalidates.supplier,
  );

  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors },
  } = useForm<SupplierInput>({
    resolver: zodResolver(supplierInputSchema),
    defaultValues: supplier ? toFormValues(supplier) : emptySupplier,
  });

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    setSaved("");
    const result = await save.mutateAsync(values);
    if (!result.ok) {
      setError(result.error);
      applyFieldErrors(setFieldError, result.fieldErrors);
      return;
    }
    if (supplier) {
      onDone();
    } else {
      reset(emptySupplier);
      setSaved(`Dobavljač ${values.name} je dodan.`);
    }
  });

  const field = (name: keyof SupplierInput, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={`supplier-${name}`}>{label}</Label>
      <Input id={`supplier-${name}`} type={type} aria-invalid={Boolean(errors[name])} {...register(name)} />
      <FormMessage className="text-xs">{errors[name]?.message}</FormMessage>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{supplier ? `Uredi: ${supplier.name}` : "Novi dobavljač"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={onSubmit} noValidate>
          <fieldset disabled={save.isPending} className="space-y-3">
            {field("name", "Naziv")}
            <div className="grid gap-3 sm:grid-cols-2">
              {field("jib", "JIB (13 cifara)")}
              {field("pdvNumber", "PDV broj (12 cifara)")}
            </div>
            {field("address", "Adresa")}
            {field("city", "Grad")}
            <div className="grid gap-3 sm:grid-cols-2">
              {field("phone", "Telefon", "tel")}
              {field("email", "E-mail", "email")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-note">Napomena</Label>
              <Textarea id="supplier-note" {...register("note")} />
              <FormMessage className="text-xs">{errors.note?.message}</FormMessage>
            </div>
          </fieldset>
          <FormMessage>{error}</FormMessage>
          {saved && <FormMessage tone="info">{saved}</FormMessage>}
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Spremanje..." : supplier ? "Spremi izmjene" : "Dodaj dobavljača"}
            </Button>
            {supplier && (
              <Button type="button" variant="outline" disabled={save.isPending} onClick={onDone}>
                Odustani
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
