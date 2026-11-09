import { ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export function Forbidden() {
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-600" />
          Nemate pristup
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-600">
        Vaša uloga nema ovlasti za ovu stranicu. Ako mislite da je to greška, obratite se administratoru.
      </CardContent>
    </Card>
  );
}
