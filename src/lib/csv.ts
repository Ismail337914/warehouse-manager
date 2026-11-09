export type CsvValue = string | number | null | undefined;

export function toCsv(rows: Array<Record<string, CsvValue>>, columns: Array<{ key: string; label: string }>) {
  const escape = (value: CsvValue) => {
    let text = String(value ?? "");
    // Formula injection: Excel evaluates a cell that starts with = + - @ (also after leading whitespace or line
    // breaks). Customer names and notes are typed by users, so such cells are prefixed with ' to stay plain text.
    // Plain numbers (e.g. a negative stock change) can't be formulas and stay numbers.
    const plainNumber = typeof value === "number" || /^-?\d+([.,]\d+)?$/.test(text);
    if (!plainNumber && /^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };

  return [
    columns.map(({ label }) => escape(label)).join(","),
    ...rows.map((row) => columns.map(({ key }) => escape(row[key])).join(",")),
  ].join("\r\n");
}
