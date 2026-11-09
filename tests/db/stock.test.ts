import { beforeAll, describe, expect, it } from "vitest";

import { createTestProduct, movementsOf, newKey, serviceClient, signInAs, stockOf } from "./helpers";

type Client = Awaited<ReturnType<typeof signInAs>>;

let menadzer: Client;
let prodavac: Client;

beforeAll(async () => {
  [menadzer, prodavac] = await Promise.all([signInAs("menadzer"), signInAs("prodavac")]);
});

const adjust = (client: Client, productId: string, change: number, reason = "Oštećeno pri transportu", key = newKey()) =>
  client.rpc("adjust_stock", {
    p_idempotency_key: key,
    p_product_id: productId,
    p_quantity_change: change,
    p_reason: reason,
  });

describe("goods receipt", () => {
  it("adds stock and books one 'prijem' movement per product", async () => {
    const productId = await createTestProduct(menadzer, 4);
    expect(await stockOf(productId)).toEqual({ quantity: 4, reserved_quantity: 0, available_quantity: 4 });
    expect(await movementsOf(productId)).toEqual([
      { type: "prijem", on_hand_change: 4, reserved_change: 0, source_type: "prijem", source_id: expect.stringMatching(/^PRI-/) },
    ]);
  });

  it("is booked once when retried with the same key", async () => {
    const productId = await createTestProduct(menadzer, 0);
    const key = newKey();
    const receive = () =>
      menadzer.rpc("receive_stock", {
        p_idempotency_key: key,
        p_supplier_id: "SUP-1",
        p_document_number: "OTP-1",
        p_note: "",
        p_items: [{ product_id: productId, quantity: 3, unit_cost: 10 }],
      });
    await receive();
    await receive();
    expect((await stockOf(productId)).quantity).toBe(3);
  });
});

describe("corrections and stock counts", () => {
  it("requires a reason for a correction", async () => {
    const productId = await createTestProduct(menadzer, 5);
    expect((await adjust(menadzer, productId, -1, " ")).error?.message).toBe("Razlog korekcije je obavezan.");
  });

  it("never takes stock below what confirmed orders have reserved", async () => {
    const productId = await createTestProduct(menadzer, 5);
    const { data: order } = await prodavac.rpc("create_order", {
      p_idempotency_key: newKey(),
      p_customer_id: "CUS-1001",
      p_source: "web",
      p_note: "",
      p_items: [{ product_id: productId, quantity: 4 }],
    });
    await prodavac.rpc("confirm_order", { p_idempotency_key: newKey(), p_order_id: (order as { id: string }).id });

    expect((await adjust(menadzer, productId, -2)).error?.message).toBe("Stanje ne može biti manje od rezervisane količine (4).");
    expect((await adjust(menadzer, productId, -1)).error).toBeNull();
    expect(await stockOf(productId)).toEqual({ quantity: 4, reserved_quantity: 4, available_quantity: 0 });
  });

  it("sets counted quantities and books only the differences", async () => {
    const counted = await createTestProduct(menadzer, 10);
    const unchanged = await createTestProduct(menadzer, 3);

    const { data, error } = await menadzer.rpc("stock_count", {
      p_idempotency_key: newKey(),
      p_reason: "Godišnja inventura",
      p_items: [
        { product_id: counted, counted_quantity: 8 },
        { product_id: unchanged, counted_quantity: 3 },
      ],
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ changed_products: 1 });
    expect((await stockOf(counted)).quantity).toBe(8);
    expect((await movementsOf(counted)).at(-1)).toMatchObject({ type: "inventura", on_hand_change: -2 });
    expect(await movementsOf(unchanged)).toHaveLength(1);
  });
});

describe("permissions", () => {
  it("does not let a seller receive, correct or count stock", async () => {
    const productId = await createTestProduct(menadzer, 5);
    const denied = "Nemate ovlasti za ovu radnju.";

    expect((await adjust(prodavac, productId, 1)).error?.message).toBe(denied);
    const receive = await prodavac.rpc("receive_stock", {
      p_idempotency_key: newKey(),
      p_supplier_id: "",
      p_document_number: "",
      p_note: "",
      p_items: [{ product_id: productId, quantity: 1, unit_cost: 1 }],
    });
    expect(receive.error?.message).toBe(denied);
    const count = await prodavac.rpc("stock_count", {
      p_idempotency_key: newKey(),
      p_reason: "x",
      p_items: [{ product_id: productId, counted_quantity: 0 }],
    });
    expect(count.error?.message).toBe(denied);
    expect((await stockOf(productId)).quantity).toBe(5);
  });

  it("hides idempotency keys and document counters from the API", async () => {
    const { data: keys } = await menadzer.from("idempotency_keys").select("*");
    expect(keys ?? []).toHaveLength(0);
    const { data: counters } = await menadzer.from("document_counters").select("*");
    expect(counters ?? []).toHaveLength(0);
  });
});

describe("ledger", () => {
  it("is append-only, even for the service role", async () => {
    const productId = await createTestProduct(menadzer, 1);
    const service = serviceClient();
    const message = "Kretanja zaliha se ne mogu mijenjati ni brisati. Unesite korekciju.";

    expect((await service.from("inventory_movements").update({ reason: "x" }).eq("product_id", productId)).error?.message).toBe(message);
    expect((await service.from("inventory_movements").delete().eq("product_id", productId)).error?.message).toBe(message);
  });

  it("explains every product's stock and reservations exactly", async () => {
    const service = serviceClient();
    const [{ data: products }, { data: movements }] = await Promise.all([
      service.from("products").select("id, quantity, reserved_quantity"),
      service.from("inventory_movements").select("product_id, on_hand_change, reserved_change"),
    ]);

    const totals = new Map<string, { onHand: number; reserved: number }>();
    for (const movement of movements ?? []) {
      const total = totals.get(movement.product_id) ?? { onHand: 0, reserved: 0 };
      total.onHand += movement.on_hand_change;
      total.reserved += movement.reserved_change;
      totals.set(movement.product_id, total);
    }

    for (const product of products ?? []) {
      expect(totals.get(product.id) ?? { onHand: 0, reserved: 0 }, product.id).toEqual({
        onHand: product.quantity,
        reserved: product.reserved_quantity,
      });
    }
  });
});
