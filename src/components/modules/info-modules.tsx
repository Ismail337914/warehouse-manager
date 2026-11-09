import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableRow } from "@/components/ui";

export function PlaceholderModule({ title, description }: { title: string; description: string }) {
  return (
    <Card className="mx-auto max-w-2xl border-dashed border-slate-300 bg-slate-50">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-slate-600">
        <div className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">Modul je trenutno u fazi razvoja</span>
        </div>
        <p>{description}</p>
        <p>Prikazan je placeholder za buduću implementaciju i nije angažiran u stvarne poslovne procese.</p>
      </CardContent>
    </Card>
  );
}

export function GenericTableModule({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium text-slate-700">{row.label}</TableCell>
                <TableCell>{row.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function IntegrationsModule() {
  return (
    <GenericTableModule
      title="Integracije"
      rows={[
        { label: "Supabase / PostgreSQL", value: "Baza aplikacije • Aktivno" },
        { label: "OLX", value: "Nije povezano • Dostupnost API pristupa nije potvrđena" },
        { label: "Viber", value: "Nije povezano • Dostupnost API pristupa nije potvrđena" },
        { label: "E-mail / web-forma", value: "Nije povezano • Nema automatske sinhronizacije" },
      ]}
    />
  );
}

export function SettingsModule() {
  return (
    <GenericTableModule
      title="Postavke"
      rows={[
        { label: "Valuta", value: "BAM" },
        { label: "Jezik", value: "Bosanski" },
        { label: "Skladište", value: "Sarajevo - Glavni sklad" },
      ]}
    />
  );
}
