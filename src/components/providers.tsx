"use client";

import { createContext, use, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { CurrentUser } from "@/lib/permissions";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // One client per browser session; created in state so it survives re-renders but not page reloads.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const CurrentUserContext = createContext<CurrentUser | null>(null);

// The user is resolved on the server (src/server/auth.ts) and handed to client components. The UI uses the
// role only to hide what the user can't do; Server Actions and the database check it again.
export function CurrentUserProvider({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return <CurrentUserContext value={user}>{children}</CurrentUserContext>;
}

export function useCurrentUser() {
  const user = use(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  return user;
}
