import { describe, expect, it } from "vitest";

import { documentTotals, lineAmounts, roundMoney } from "./money";

describe("lineAmounts", () => {
  it("computes net, VAT and gross for a line without discount", () => {
    expect(lineAmounts({ quantity: 2, unitPrice: 1299, vatRate: 17 })).toEqual({ net: 2598, vat: 441.66, gross: 3039.66 });
  });

  it("applies the discount before VAT", () => {
    // 3 × 33.33 = 99.99; −7.5 % = 92.49075 → 92.49; VAT 17 % = 15.7233 → 15.72
    expect(lineAmounts({ quantity: 3, unitPrice: 33.33, discountPercent: 7.5, vatRate: 17 })).toEqual({
      net: 92.49,
      vat: 15.72,
      gross: 108.21,
    });
  });

  it("rounds half away from zero like PostgreSQL", () => {
    // 1 × 0.05 × 0.5 = 0.025 → 0.03 (not banker's rounding to 0.02)
    expect(lineAmounts({ quantity: 1, unitPrice: 0.05, discountPercent: 50, vatRate: 0 }).net).toBe(0.03);
    // VAT 17 % of 0.5 = 0.085 → 0.09
    expect(lineAmounts({ quantity: 1, unitPrice: 0.5, vatRate: 17 }).vat).toBe(0.09);
  });

  it("has no floating-point drift", () => {
    // 0.1 + 0.2 style errors would show up here with plain number math.
    expect(lineAmounts({ quantity: 3, unitPrice: 0.1, vatRate: 0 }).net).toBe(0.3);
    expect(lineAmounts({ quantity: 1, unitPrice: 1.15, discountPercent: 0, vatRate: 17 })).toEqual({
      net: 1.15,
      vat: 0.2,
      gross: 1.35,
    });
  });

  it("handles a 100 % discount and a 0 % VAT rate", () => {
    expect(lineAmounts({ quantity: 5, unitPrice: 10, discountPercent: 100, vatRate: 17 })).toEqual({ net: 0, vat: 0, gross: 0 });
    expect(lineAmounts({ quantity: 5, unitPrice: 10, vatRate: 0 })).toEqual({ net: 50, vat: 0, gross: 50 });
  });
});

describe("documentTotals", () => {
  it("sums rounded lines (VAT per line, not on the total)", () => {
    const lines = [
      { quantity: 1, unitPrice: 0.5, vatRate: 17 },
      { quantity: 1, unitPrice: 0.5, vatRate: 17 },
    ];
    // Per line: 0.085 → 0.09 each, so VAT is 0.18 (on the total it would be 0.17).
    expect(documentTotals(lines)).toEqual({ net: 1, vat: 0.18, gross: 1.18 });
  });

  it("matches the seeded order SO-1024 in the database", () => {
    expect(
      documentTotals([
        { quantity: 2, unitPrice: 1299, vatRate: 17 },
        { quantity: 1, unitPrice: 139, vatRate: 17 },
      ]),
    ).toEqual({ net: 2737, vat: 465.29, gross: 3202.29 });
  });

  it("returns zeros for an empty document", () => {
    expect(documentTotals([])).toEqual({ net: 0, vat: 0, gross: 0 });
  });
});

describe("roundMoney", () => {
  it("rounds to 2 decimals, half away from zero", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.344)).toBe(2.34);
    expect(roundMoney(-1.005)).toBe(-1.01);
  });
});
