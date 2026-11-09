import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes delimiters, quotes and line breaks", () => {
    expect(toCsv([{ name: 'Kamera, "Pro"\nModel' }], [{ key: "name", label: "Naziv" }])).toBe(
      '"Naziv"\r\n"Kamera, ""Pro""\nModel"',
    );
  });

  it("protects values that spreadsheet software could evaluate as formulas", () => {
    expect(toCsv([{ name: "=1+1" }, { name: " @SUM(A1:A2)" }], [{ key: "name", label: "Naziv" }])).toBe(
      '"Naziv"\r\n"\'=1+1"\r\n"\' @SUM(A1:A2)"',
    );
  });

  it("protects formulas starting with + or - and those after tabs or line breaks", () => {
    const cell = (value: string) => toCsv([{ v: value }], [{ key: "v", label: "x" }]).split("\r\n")[1];
    expect(cell("+381")).toBe('"\'+381"');
    expect(cell("-2+3")).toBe('"\'-2+3"');
    expect(cell("\t=cmd")).toBe('"\'\t=cmd"');
    expect(cell("\r=cmd")).toBe('"\'\r=cmd"');
    expect(cell("\n=HYPERLINK(\"http://x\")")).toBe('"\'\n=HYPERLINK(""http://x"")"');
    // Plain numbers can't be formulas and stay numbers.
    expect(toCsv([{ v: -5 }], [{ key: "v", label: "x" }]).split("\r\n")[1]).toBe('"-5"');
    expect(cell("-12,50")).toBe('"-12,50"');
  });
});
