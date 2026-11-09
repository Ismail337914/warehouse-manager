export const PAGE_SIZE = 20;

// Search text for PostgREST "ilike" filters inside or(...). Commas and parentheses would break the filter
// syntax, and % _ * would act as wildcards, so they are replaced with spaces.
export function sanitizeSearch(value: string) {
  return value.replace(/[,()%_*\\]/g, " ").replace(/\s+/g, " ").trim();
}

// Row range for page n (1-based) as used by Supabase .range(from, to).
export function pageRange(page: number, pageSize = PAGE_SIZE) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function pageCount(total: number, pageSize = PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}
