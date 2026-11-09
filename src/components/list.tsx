"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button, Input } from "@/components/ui";
import { pageCount } from "@/lib/search";
import { cn } from "@/lib/utils";

// Text search that updates the URL 300 ms after the user stops typing.
export function SearchInput({
  value,
  onSearch,
  label,
  className,
}: {
  value: string;
  onSearch: (value: string) => void;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    if (text === value) return;
    const timeout = setTimeout(() => onSearch(text), 300);
    return () => clearTimeout(timeout);
  }, [text, value, onSearch]);

  return (
    <div className={cn("relative w-full md:w-72", className)}>
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <Input className="pl-9" type="search" aria-label={label} placeholder={label} value={text} onChange={(event) => setText(event.target.value)} />
    </div>
  );
}

export function Pagination({
  page,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const pages = pageCount(total, pageSize);
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-slate-600">
      <span>
        {first}–{last} od {total}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Prethodna stranica">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Sljedeća stranica">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Loading, error and empty states shared by every list and detail view.
export function QueryState({
  isPending,
  error,
  isEmpty,
  emptyText,
  children,
}: {
  isPending: boolean;
  error: Error | null;
  isEmpty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  if (isPending) return <p className="py-6 text-center text-sm text-slate-500">Učitavanje...</p>;
  if (error) return <p role="alert" className="py-6 text-center text-sm text-red-600">{error.message}</p>;
  if (isEmpty) return <p className="py-6 text-center text-sm text-slate-500">{emptyText ?? "Nema podataka."}</p>;
  return children;
}
