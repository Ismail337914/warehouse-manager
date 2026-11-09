import { Suspense } from "react";

import { AppShell, AppShellSkeleton } from "@/components/app-shell";
import { CurrentUserProvider, QueryProvider } from "@/components/providers";
import { UserMenu } from "@/components/user-menu";
import { requireUser } from "@/server/auth";

// The shell needs the user's role (the sidebar shows only allowed modules), so it renders once the session is
// read, behind a skeleton (required with Cache Components). getCurrentUser() is cached per session in the
// browser, so navigation between pages stays instant. Every page also checks access itself (RequireAccess).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <Suspense fallback={<AppShellSkeleton />}>
        <SignedIn>
          <AppShell
            userMenu={
              <Suspense fallback={<div className="h-12 w-40 animate-pulse rounded-full bg-slate-100" />}>
                <UserMenu />
              </Suspense>
            }
          >
            <Suspense fallback={<p className="text-sm text-slate-500">Učitavanje...</p>}>{children}</Suspense>
          </AppShell>
        </SignedIn>
      </Suspense>
    </QueryProvider>
  );
}

// Server-side gate: everything below renders only for an active, signed-in user, who is then available to
// client components through useCurrentUser().
async function SignedIn({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <CurrentUserProvider user={user}>{children}</CurrentUserProvider>;
}
