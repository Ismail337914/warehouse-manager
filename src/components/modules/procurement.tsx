"use client";

import { useQuery } from "@tanstack/react-query";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { QueryState } from "@/components/list";
import { fetchProcurementDocs } from "@/lib/queries/procurement";
import { queryKeys } from "@/lib/query-keys";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatMoney } from "@/lib/utils";

export function ProcurementModule() {
  const procurement = useQuery({
    queryKey: queryKeys.procurement.all,
    queryFn: () => fetchProcurementDocs(createClient()),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nabavka</CardTitle>
        <CardDescription>
          Evidencija demo dokumenata iz baze. Kreiranje nabavki i stavke narudžbe još nisu implementirani.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState
          isPending={procurement.isPending}
          error={procurement.error}
          isEmpty={procurement.data?.length === 0}
          emptyText="Nema evidentiranih nabavki."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dobavljač</TableHead>
                <TableHead>Dokument</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Iznos</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {procurement.data?.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.supplier?.name ?? "—"}</TableCell>
                  <TableCell>{doc.document_number}</TableCell>
                  <TableCell>{formatDate(doc.created_at)}</TableCell>
                  <TableCell>{formatMoney(doc.total)}</TableCell>
                  <TableCell>
                    <Badge variant={doc.status === "primljeno" ? "success" : doc.status === "otkazano" ? "danger" : "warning"}>
                      {doc.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </QueryState>
      </CardContent>
    </Card>
  );
}
