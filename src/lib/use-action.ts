"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { ActionResult } from "@/server/result";

// Runs a Server Action through TanStack Query: isPending disables the submit button, and after a success
// every listed query is invalidated so lists, details and stock refresh.
export function useAction<TInput, TData>(
  action: (input: TInput) => Promise<ActionResult<TData>>,
  invalidate: readonly QueryKey[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: async (result) => {
      if (!result.ok) return;
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
}

// Shows server-side validation errors next to the form fields.
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string> | undefined,
) {
  for (const [path, message] of Object.entries(fieldErrors ?? {})) {
    setError(path as Path<T>, { message });
  }
}
