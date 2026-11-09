"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button, FormMessage } from "@/components/ui";
import { toCsv, type CsvValue } from "@/lib/csv";

export function CsvExportButton<T extends Record<string, CsvValue>>({
  loadRows,
  columns,
  fileName,
}: {
  loadRows: () => Promise<T[]>;
  columns: Array<{ key: string; label: string }>;
  fileName: string;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const exportCsv = async () => {
    setError("");
    setLoading(true);
    try {
      const rows = await loadRows();
      const content = `\uFEFF${toCsv(rows, columns)}`;
      const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CSV datoteka nije izvezena.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void exportCsv()}>
        <Download className="h-4 w-4" />
        {loading ? "Priprema CSV-a..." : "Izvoz CSV"}
      </Button>
      {error && <FormMessage role="alert" className="text-xs">{error}</FormMessage>}
    </div>
  );
}
