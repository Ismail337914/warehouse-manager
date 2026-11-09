"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// List filters and the page number live in the URL (?q=&status=&page=), so a list can be bookmarked,
// shared and restored with the back button. Changing a filter goes back to page 1.
export function useListParams<T extends Record<string, string>>(defaults: T) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const values = Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [key, searchParams.get(key) ?? fallback]),
  ) as T;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const update = (changes: Partial<T> & { page?: number }) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (key === "page") continue;
      if (value === undefined || value === "" || value === defaults[key]) next.delete(key);
      else next.set(key, String(value));
    }
    if (changes.page && changes.page > 1) next.set("page", String(changes.page));
    else next.delete("page");

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return { values, page, update };
}
