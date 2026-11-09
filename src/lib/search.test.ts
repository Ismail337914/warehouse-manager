import { describe, expect, it } from "vitest";

import { pageCount, pageRange, sanitizeSearch } from "./search";

describe("sanitizeSearch", () => {
  it("keeps normal text, including Bosnian letters", () => {
    expect(sanitizeSearch("  Službeni stolac ")).toBe("Službeni stolac");
  });

  it("removes characters that would break or widen the filter", () => {
    expect(sanitizeSearch("a,b)c(d")).toBe("a b c d");
    expect(sanitizeSearch("100%_*")).toBe("100");
    expect(sanitizeSearch("name.ilike.*,id.eq.1")).toBe("name.ilike. id.eq.1");
  });
});

describe("pagination", () => {
  it("maps pages to row ranges", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 19 });
    expect(pageRange(3)).toEqual({ from: 40, to: 59 });
  });

  it("falls back to the first page for invalid input", () => {
    expect(pageRange(0)).toEqual({ from: 0, to: 19 });
    expect(pageRange(Number.NaN)).toEqual({ from: 0, to: 19 });
  });

  it("always reports at least one page", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(20)).toBe(1);
    expect(pageCount(21)).toBe(2);
  });
});
