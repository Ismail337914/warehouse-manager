"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { QueryState } from "@/components/list";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormMessage,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type Feedback,
} from "@/components/ui";
import { fetchCategoryList, type CategoryListRow } from "@/lib/queries/products";
import { invalidates, queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useAction } from "@/lib/use-action";
import { createCategory, deleteCategory, updateCategory } from "@/server/actions/products";

// The page is guarded on the server (RequireAccess, "categories.manage"); RLS allows the same roles.
export function CategoryManager() {
  const categories = useQuery({ queryKey: queryKeys.categories.list, queryFn: () => fetchCategoryList(createClient()) });
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  return (
    <div className="space-y-6">
      <Link href="/warehouse" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Nazad na lager
      </Link>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Kategorije</CardTitle>
          <CardDescription>Kategorija s proizvodima se ne može obrisati; prvo premjestite proizvode u drugu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NewCategoryRow onDone={setFeedback} />
          <FormMessage tone={feedback?.tone}>{feedback?.text}</FormMessage>
          <QueryState
            isPending={categories.isPending}
            error={categories.error}
            isEmpty={categories.data?.length === 0}
            emptyText="Još nema kategorija."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naziv</TableHead>
                  <TableHead className="text-right">Proizvoda</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.data?.map((category) => (
                  <CategoryRow key={category.id} category={category} onDone={setFeedback} />
                ))}
              </TableBody>
            </Table>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}

function NewCategoryRow({ onDone }: { onDone: (feedback: Feedback) => void }) {
  const [name, setName] = useState("");
  const create = useAction(createCategory, invalidates.category);

  const submit = async () => {
    const result = await create.mutateAsync({ name });
    if (!result.ok) {
      onDone({ tone: "error", text: result.fieldErrors?.name ?? result.error });
      return;
    }
    onDone({ tone: "info", text: `Kategorija ${name.trim()} je dodana.` });
    setName("");
  };

  return (
    <div className="flex gap-2">
      <Input
        aria-label="Naziv nove kategorije"
        placeholder="Nova kategorija"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (!create.isPending) void submit();
          }
        }}
      />
      <Button type="button" disabled={create.isPending} onClick={() => void submit()}>
        Dodaj
      </Button>
    </div>
  );
}

function CategoryRow({ category, onDone }: { category: CategoryListRow; onDone: (feedback: Feedback) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const rename = useAction((value: string) => updateCategory(category.id, { name: value }), invalidates.category);
  const remove = useAction(deleteCategory, invalidates.category);
  const busy = rename.isPending || remove.isPending;

  const onRename = async () => {
    const result = await rename.mutateAsync(name);
    if (!result.ok) {
      onDone({ tone: "error", text: result.fieldErrors?.name ?? result.error });
      return;
    }
    setEditing(false);
    onDone({ tone: "info", text: `Kategorija je preimenovana u ${name.trim()}.` });
  };

  const onDelete = async () => {
    const result = await remove.mutateAsync(category.id);
    onDone(result.ok ? { tone: "info", text: `Kategorija ${category.name} je obrisana.` } : { tone: "error", text: result.error });
  };

  return (
    <TableRow>
      <TableCell>
        {editing ? (
          <Input
            aria-label={`Novi naziv za ${category.name}`}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!busy) void onRename();
              }
              if (event.key === "Escape") {
                setName(category.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="font-medium text-slate-900">{category.name}</span>
        )}
      </TableCell>
      <TableCell className="text-right">{category.productCount}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => void onRename()}>
                Spremi
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setName(category.name);
                  setEditing(false);
                }}
              >
                Odustani
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
                Preimenuj
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600"
                disabled={busy || category.productCount > 0}
                title={category.productCount > 0 ? "Kategorija ima proizvode" : undefined}
                onClick={() => void onDelete()}
              >
                Obriši
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
