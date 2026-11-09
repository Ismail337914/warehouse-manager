import { describe, expect, it } from "vitest";

import { maxDiscount } from "./discount";

const settings = { max_discount_prodavac: 10, max_discount_menadzer: 30 };

describe("maxDiscount", () => {
  it("takes the role's limit from settings", () => {
    expect(maxDiscount("prodavac", settings)).toBe(10);
    expect(maxDiscount("menadzer", settings)).toBe(30);
  });

  it("gives admins no limit, even before settings load", () => {
    expect(maxDiscount("admin", settings)).toBe(100);
    expect(maxDiscount("admin", undefined)).toBe(100);
  });

  it("allows no discount until settings load", () => {
    expect(maxDiscount("prodavac", undefined)).toBe(0);
  });
});
