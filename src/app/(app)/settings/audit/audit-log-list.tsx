"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { Pagination, QueryState } from "@/components/list";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  NativeSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { auditActionLabels, paymentMethodLabels } from "@/lib/labels";
import { roleLabels, type AppRole } from "@/lib/permissions";
import { fetchAuditLogs, type AuditLogRow } from "@/lib/queries/audit";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { useListParams } from "@/lib/use-list-params";
import { formatDateTime, formatMoney } from "@/lib/utils";

type Details = Record<string, unknown>;
type Change = { old?: unknown; new?: unknown };

const text = (value: unknown) => (value === null || value === undefined || value === "" ? "—" : String(value));
const role = (value: unknown) => roleLabels[value as AppRole] ?? text(value);
const change = (value: unknown, format: (value: unknown) => string = text) => {
  const { old, new: next } = (value ?? {}) as Change;
  return `${format(old)} → ${format(next)}`;
};

// One readable line per event, from the details the audit triggers store.
function describe(entry: AuditLogRow) {
  const details = (entry.details ?? {}) as Details;
  switch (entry.action) {
    case "korisnik.kreiran":
      return `${text(details.email)}, ${role(details.role)}${details.is_active ? "" : ", bez pristupa dok ga admin ne aktivira"}`;
    case "korisnik.uloga":
      return `${text(details.email)}: ${role(details.old)} → ${role(details.new)}`;
    case "korisnik.aktiviran":
    case "korisnik.deaktiviran":
      return text(details.email);
    case "postavke.izmjena":
      return Object.entries(details)
        .map(([field, value]) => `${field}: ${change(value)}`)
        .join("; ");
    case "faktura.storno":
      return `Storno dokument ${text(details.storno_number)}, ${formatMoney(Number(details.total ?? 0))}`;
    case "uplata.evidentirana":
      return `${formatMoney(Number(details.amount ?? 0))}, ${paymentMethodLabels[details.method as keyof typeof paymentMethodLabels] ?? text(details.method)}, ${text(details.paid_on)}`;
    case "zalihe.korekcija":
    case "zalihe.inventura": {
      const amount = Number(details.change ?? 0);
      return `${amount > 0 ? "+" : ""}${amount}, novo stanje ${text(details.after)} · ${text(details.reason)}`;
    }
    case "narudzba.dodjela":
      return `Narudžba ${text(details.number)}`;
    case "proizvod.cijena":
      return `${text(details.sku)}: nabavna ${change(details.buy_price)}, prodajna ${change(details.sell_price)}`;
    default:
      return JSON.stringify(details);
  }
}

const entityLinks: Record<string, (id: string) => string> = {
  products: (id) => `/warehouse/${id}`,
  invoices: (id) => `/invoices/${id}`,
  orders: (id) => `/orders/${id}`,
};

export function AuditLogList() {
  const { values, page, update } = useListParams({ action: "" });
  const params = { ...values, page };
  const logs = useQuery({
    queryKey: queryKeys.audit.list(params),
    queryFn: () => fetchAuditLogs(createClient(), params),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Nazad na postavke
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>
            Promjene uloga i korisnika, postavki i cijena, korekcije zaliha, storna, uplate i dodjele narudžbi. Zapise niko ne
            može mijenjati ni brisati.
          </CardDescription>
          <div className="pt-3">
            <NativeSelect className="md:w-64" aria-label="Vrsta događaja" value={values.action} onChange={(event) => update({ action: event.target.value })}>
              <option value="">Svi događaji</option>
              {Object.entries(auditActionLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </NativeSelect>
          </div>
        </CardHeader>
        <CardContent>
          <QueryState isPending={logs.isPending} error={logs.error} isEmpty={logs.data?.rows.length === 0} emptyText="Nema zapisa.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vrijeme</TableHead>
                  <TableHead>Korisnik</TableHead>
                  <TableHead>Događaj</TableHead>
                  <TableHead>Detalji</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data?.rows.map((entry) => {
                  const link = entry.entity_id && entityLinks[entry.entity]?.(entry.entity_id);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(entry.created_at)}</TableCell>
                      <TableCell>{entry.actor ? entry.actor.full_name || entry.actor.email : <span className="text-slate-400">Sistem</span>}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{auditActionLabels[entry.action] ?? entry.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {describe(entry)}
                        {link && (
                          <Link href={link} className="ml-2 text-slate-900 hover:underline">
                            Otvori
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination
              page={page}
              total={logs.data?.total ?? 0}
              pageSize={logs.data?.pageSize ?? 20}
              onPageChange={(next) => update({ page: next })}
            />
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
