import { describe, expect, it } from "vitest";

import { currentMonthKey, monthRange } from "./month";

describe("month ranges", () => {
  it("returns a half-open range and handles December rollover", () => {
    expect(monthRange("2026-10")).toEqual({ start: "2026-10-01", end: "2026-11-01" });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });

  it("rejects malformed month values", () => {
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("2026-2")).toBeNull();
    expect(monthRange("0000-01")).toBeNull();
  });

  it("uses Sarajevo's calendar month", () => {
    expect(currentMonthKey(new Date("2026-09-30T23:30:00.000Z"))).toBe("2026-10");
  });
});
