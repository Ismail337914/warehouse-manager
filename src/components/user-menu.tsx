import Link from "next/link";
import { KeyRound, LogOut } from "lucide-react";

import { Button } from "@/components/ui";
import { roleLabels } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth";
import { signOut } from "@/server/actions/auth";

function initials(name: string, email: string) {
  const parts = (name || email).split(/[\s@.]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {initials(user.fullName, user.email)}
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-sm font-medium text-slate-900">{user.fullName || user.email}</p>
          <p className="text-xs text-slate-500">{roleLabels[user.role]}</p>
        </div>
      </div>
      <Button asChild variant="outline" size="icon" aria-label="Promijeni lozinku" title="Promijeni lozinku">
        <Link href="/account/password">
          <KeyRound className="h-4 w-4" />
        </Link>
      </Button>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="icon" aria-label="Odjava" title="Odjava">
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
