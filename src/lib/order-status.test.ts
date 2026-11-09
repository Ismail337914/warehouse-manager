import { describe, expect, it } from "vitest";

import { canTransition, hasLeftWarehouse, holdsReservation, orderTransitions, type OrderStatus } from "./order-status";

describe("order status transitions", () => {
  it("follows nacrt → potvrđena → isporučena → fakturisana", () => {
    expect(canTransition("nacrt", "potvrđena")).toBe(true);
    expect(canTransition("potvrđena", "isporučena")).toBe(true);
    expect(canTransition("isporučena", "fakturisana")).toBe(true);
  });

  it("allows cancelling only drafts and confirmed orders", () => {
    expect(canTransition("nacrt", "otkazana")).toBe(true);
    expect(canTransition("potvrđena", "otkazana")).toBe(true);
    expect(canTransition("isporučena", "otkazana")).toBe(false);
    expect(canTransition("fakturisana", "otkazana")).toBe(false);
  });

  it("never skips a step or goes back", () => {
    expect(canTransition("nacrt", "isporučena")).toBe(false);
    expect(canTransition("nacrt", "fakturisana")).toBe(false);
    expect(canTransition("potvrđena", "nacrt")).toBe(false);
    expect(canTransition("isporučena", "potvrđena")).toBe(false);
  });

  it("has no way out of final statuses or into the same status", () => {
    expect(orderTransitions.fakturisana).toEqual([]);
    expect(orderTransitions.otkazana).toEqual([]);
    for (const status of Object.keys(orderTransitions) as OrderStatus[]) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("describes what happens to stock", () => {
    expect(holdsReservation("potvrđena")).toBe(true);
    expect(holdsReservation("nacrt")).toBe(false);
    expect(hasLeftWarehouse("isporučena")).toBe(true);
    expect(hasLeftWarehouse("fakturisana")).toBe(true);
    expect(hasLeftWarehouse("otkazana")).toBe(false);
  });
});
