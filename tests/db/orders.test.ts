import { beforeAll, describe, expect, it } from "vitest";

import { documentTotals } from "@/lib/money";

import { createTestProduct, movementsOf, newKey, serviceClient, signInAs, stockOf } from "./helpers";

type Client = Awaited<ReturnType<typeof signInAs>>;
type Line = { product_id: string; quantity: number; discount_percent?: number };

let admin: Client;
let menadzer: Client;
let prodavac: Client;

beforeAll(async () => {
  [admin, menadzer, prodavac] = await Promise.all([signInAs("admin"), signInAs("menadzer"), signInAs("prodavac")]);
});

async function createDraft(client: Client, items: Line[], key = newKey()) {
  const { data, error } = await client.rpc("create_order", {
    p_idempotency_key: key,
    p_customer_id: "CUS-1001",
    p_source: "web",
    p_note: "Test",
    p_items: items,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; number: string; status: string; subtotal: number; vat_total: number; total: number };
}

const confirm = (client: Client, orderId: string, key = newKey()) =>
  client.rpc("confirm_order", { p_idempotency_key: key, p_order_id: orderId });
const deliver = (client: Client, orderId: string, key = newKey()) =>
  client.rpc("deliver_order", { p_idempotency_key: key, p_order_id: orderId });
const cancel = (client: Client, orderId: string, key = newKey()) =>
  client.rpc("cancel_order", { p_idempotency_key: key, p_order_id: orderId, p_reason: "Test" });

describe("order workflow", () => {
  it("reserves on confirm, removes stock on delivery and records every step in the ledger", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const order = await createDraft(prodavac, [{ product_id: productId, quantity: 3 }]);
    expect(order.status).toBe("nacrt");
    expect(await stockOf(productId)).toEqual({ quantity: 10, reserved_quantity: 0, available_quantity: 10 });

    expect((await confirm(prodavac, order.id)).error).toBeNull();
    expect(await stockOf(productId)).toEqual({ quantity: 10, reserved_quantity: 3, available_quantity: 7 });

    expect((await deliver(prodavac, order.id)).error).toBeNull();
    expect(await stockOf(productId)).toEqual({ quantity: 7, reserved_quantity: 0, available_quantity: 7 });

    const movements = await movementsOf(productId);
    expect(movements).toEqual(
      expect.arrayContaining([
        { type: "prijem", on_hand_change: 10, reserved_change: 0, source_type: "prijem", source_id: expect.any(String) },
        { type: "rezervacija", on_hand_change: 0, reserved_change: 3, source_type: "narudzba", source_id: order.id },
        { type: "izlaz", on_hand_change: -3, reserved_change: -3, source_type: "narudzba", source_id: order.id },
      ]),
    );
    expect(movements).toHaveLength(3);
  });

  it("takes prices and VAT from the database and matches src/lib/money.ts to the cent", async () => {
    const productId = await createTestProduct(menadzer, 10, 33.33);
    const order = await createDraft(menadzer, [{ product_id: productId, quantity: 3, discount_percent: 7.5 }]);
    const expected = documentTotals([{ quantity: 3, unitPrice: 33.33, discountPercent: 7.5, vatRate: 17 }]);
    expect({ net: order.subtotal, vat: order.vat_total, gross: order.total }).toEqual(expected);
  });

  it("merges the same product on two lines into one line", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const order = await createDraft(prodavac, [
      { product_id: productId, quantity: 2 },
      { product_id: productId, quantity: 3 },
    ]);
    const { data: items } = await serviceClient().from("order_items").select("quantity").eq("order_id", order.id);
    expect(items).toEqual([{ quantity: 5 }]);
  });

  it("releases the reservation when a confirmed order is cancelled", async () => {
    const productId = await createTestProduct(menadzer, 5);
    const order = await createDraft(prodavac, [{ product_id: productId, quantity: 4 }]);
    await confirm(prodavac, order.id);
    expect((await stockOf(productId)).available_quantity).toBe(1);

    expect((await cancel(prodavac, order.id)).error).toBeNull();
    expect(await stockOf(productId)).toEqual({ quantity: 5, reserved_quantity: 0, available_quantity: 5 });
  });
});

describe("stock never goes negative", () => {
  it("rejects a reservation larger than what is available", async () => {
    const productId = await createTestProduct(menadzer, 2);
    const order = await createDraft(prodavac, [{ product_id: productId, quantity: 3 }]);

    const { error } = await confirm(prodavac, order.id);
    expect(error?.message).toMatch(/^Nedovoljno dostupno: .* \(dostupno 2, traženo 3\)\.$/);
    expect(await stockOf(productId)).toEqual({ quantity: 2, reserved_quantity: 0, available_quantity: 2 });
  });

  it("rolls back every line when one line can't be reserved (one transaction)", async () => {
    const plenty = await createTestProduct(menadzer, 10);
    const scarce = await createTestProduct(menadzer, 1);
    const order = await createDraft(prodavac, [
      { product_id: plenty, quantity: 5 },
      { product_id: scarce, quantity: 2 },
    ]);

    expect((await confirm(prodavac, order.id)).error).not.toBeNull();
    expect((await stockOf(plenty)).reserved_quantity).toBe(0);
    expect(await movementsOf(plenty)).toHaveLength(1);
  });

  it("lets only 5 of 20 parallel confirmations reserve the last 5 pieces", async () => {
    const productId = await createTestProduct(menadzer, 5);
    const orders = await Promise.all(
      Array.from({ length: 20 }, () => createDraft(prodavac, [{ product_id: productId, quantity: 1 }])),
    );

    const results = await Promise.all(orders.map((order) => confirm(prodavac, order.id)));
    const succeeded = results.filter((result) => result.error === null);
    expect(succeeded).toHaveLength(5);
    expect(await stockOf(productId)).toEqual({ quantity: 5, reserved_quantity: 5, available_quantity: 0 });
  });
});

describe("idempotency", () => {
  it("books a confirmation once when the same key is sent twice", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const order = await createDraft(prodavac, [{ product_id: productId, quantity: 2 }]);
    const key = newKey();

    const first = await confirm(prodavac, order.id, key);
    const second = await confirm(prodavac, order.id, key);
    expect(second.error).toBeNull();
    expect(second.data).toEqual(first.data);
    expect((await stockOf(productId)).reserved_quantity).toBe(2);
    expect((await movementsOf(productId)).filter((movement) => movement.type === "rezervacija")).toHaveLength(1);
  });

  it("books once when a double click sends the same key in parallel", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const order = await createDraft(prodavac, [{ product_id: productId, quantity: 2 }]);
    const key = newKey();

    const results = await Promise.all([confirm(prodavac, order.id, key), confirm(prodavac, order.id, key)]);
    expect(results.every((result) => result.error === null)).toBe(true);
    expect((await stockOf(productId)).reserved_quantity).toBe(2);
  });

  it("creates one order when create_order is retried with the same key", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const key = newKey();
    const first = await createDraft(prodavac, [{ product_id: productId, quantity: 1 }], key);
    const second = await createDraft(prodavac, [{ product_id: productId, quantity: 1 }], key);
    expect(second.id).toBe(first.id);

    const { count } = await serviceClient()
      .from("order_items")
      .select("order_id", { count: "exact", head: true })
      .eq("product_id", productId);
    expect(count).toBe(1);
  });

  it("refuses a key that was used for a different operation", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const order = await createDraft(prodavac, [{ product_id: productId, quantity: 1 }]);
    const key = newKey();
    await confirm(prodavac, order.id, key);

    const { error } = await deliver(prodavac, order.id, key);
    expect(error?.message).toBe("Ključ operacije je već iskorišten za drugu radnju.");
  });
});

describe("status rules", () => {
  it("refuses transitions that skip a step or leave a final status", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const order = await createDraft(prodavac, [{ product_id: productId, quantity: 1 }]);

    expect((await deliver(prodavac, order.id)).error?.message).toContain("ne može preći iz statusa „nacrt“ u „isporučena“");

    await cancel(prodavac, order.id);
    expect((await confirm(prodavac, order.id)).error?.message).toContain("ne može preći iz statusa „otkazana“");
  });

  it("does not cancel an order that has already left the warehouse", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const order = await createDraft(prodavac, [{ product_id: productId, quantity: 1 }]);
    await confirm(prodavac, order.id);
    await deliver(prodavac, order.id);

    expect((await cancel(prodavac, order.id)).error?.message).toContain("„isporučena“ u „otkazana“");
    expect((await stockOf(productId)).quantity).toBe(9);
  });

  it("does not let anyone change status or lines outside the RPC functions", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const order = await createDraft(prodavac, [{ product_id: productId, quantity: 1 }]);

    const { data } = await admin.from("orders").update({ status: "isporučena" }).eq("id", order.id).select();
    expect(data ?? []).toHaveLength(0);
    await admin.from("order_items").update({ quantity: 99 }).eq("order_id", order.id);
    const { data: items } = await serviceClient().from("order_items").select("quantity").eq("order_id", order.id);
    expect(items).toEqual([{ quantity: 1 }]);

    // Even the service role (bypasses RLS) can't break the status rules or edit a confirmed order.
    const service = serviceClient();
    expect((await service.from("orders").update({ status: "fakturisana" }).eq("id", order.id)).error?.message).toContain(
      "ne može preći",
    );
    await confirm(prodavac, order.id);
    expect((await service.from("order_items").update({ quantity: 99 }).eq("order_id", order.id)).error?.message).toBe(
      "Stavke se mogu mijenjati samo dok je narudžba u nacrtu.",
    );
  });

  it("lets a draft be edited, but not after confirmation", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const order = await createDraft(prodavac, [{ product_id: productId, quantity: 1 }]);
    const update = () =>
      prodavac.rpc("update_order_draft", {
        p_order_id: order.id,
        p_customer_id: "CUS-1002",
        p_source: "telefon",
        p_note: "Izmjena",
        p_items: [{ product_id: productId, quantity: 4 }],
      });

    const edited = await update();
    expect(edited.error).toBeNull();
    expect(edited.data).toMatchObject({ subtotal: 400, total: 468 });

    await confirm(prodavac, order.id);
    expect((await update()).error?.message).toContain("više nije nacrt");
  });
});

describe("discounts and products", () => {
  it("limits the discount by role (prodavač 10 %, menadžer 30 %)", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const line = (discount: number) => [{ product_id: productId, quantity: 1, discount_percent: discount }];

    await expect(createDraft(prodavac, line(15))).rejects.toThrow("Popust može biti najviše 10.00 %.");
    await expect(createDraft(prodavac, line(10))).resolves.toMatchObject({ subtotal: 90 });
    await expect(createDraft(menadzer, line(15))).resolves.toMatchObject({ subtotal: 85 });
    await expect(createDraft(menadzer, line(35))).rejects.toThrow("Popust može biti najviše 30.00 %.");
    await expect(createDraft(admin, line(50))).resolves.toMatchObject({ subtotal: 50 });
  });

  it("does not order inactive products", async () => {
    await expect(createDraft(prodavac, [{ product_id: "PRD-8120", quantity: 1 }])).rejects.toThrow(
      "Proizvod PRD-8120 ne postoji ili nije aktivan.",
    );
  });
});
