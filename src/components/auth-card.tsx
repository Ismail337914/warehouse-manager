import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-backdrop relative flex min-h-screen min-h-[100svh] items-center justify-center overflow-hidden px-4 py-8 sm:py-12">
      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-3">
          <div className="auth-brand-mark flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-300 text-lg font-bold text-slate-950">
            WM
          </div>
          <p className="text-lg font-semibold text-slate-900">Warehouse Manager</p>
        </div>
        <Card className="auth-card">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
