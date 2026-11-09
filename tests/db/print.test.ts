import { beforeAll, describe, expect, it } from "vitest";

import { fetchSettings } from "@/lib/queries/products";
import { fetchPosSale } from "@/lib/queries/pos";

import { createTestProduct, newKey, signInAs } from "./helpers";

type Client = Awaited<ReturnType<typeof signInAs>>;

let admin: Client;
let menadzer: Client;
let prodavac: Client;

beforeAll(async () => {
  [admin, menadzer, prodavac] = await Promise.all([signInAs("admin"), signInAs("menadzer"), signInAs("prodavac")]);
});

async function sell(client: Client, productId: string, quantity: number) {
  const { data, error } = await client.rpc("complete_pos_sale", {
    p_idempotency_key: newKey(),
    p_customer_id: "",
    p_payment_method: "gotovina",
    p_discount_percent: 0,
    p_items: [{ product_id: productId, quantity }],
  });
  if (error) throw new Error(`Prodaja nije uspjela: ${error.message}`);
  return data as unknown as { id: string; number: string; total: number };
}

describe("printed POS receipt", () => {
  it("gives the seller their own sale with product names and the stored totals", async () => {
    const productId = await createTestProduct(menadzer, 5, 10);
    const sale = await sell(prodavac, productId, 2);

    const receipt = await fetchPosSale(prodavac, sale.id);
    expect(receipt).toMatchObject({ number: sale.number, total: sale.total, payment_method: "gotovina", customer: null });
    expect(receipt?.items).toHaveLength(1);
    expect(receipt?.items[0]).toMatchObject({ product_id: productId, quantity: 2, gross_amount: sale.total });
    expect(receipt?.items[0]?.product?.name).toMatch(/^Test proizvod /);
  });

  it("does not show a seller someone else's sale", async () => {
    const productId = await createTestProduct(menadzer, 5, 10);
    const sale = await sell(menadzer, productId, 1);

    expect(await fetchPosSale(prodavac, sale.id)).toBeNull();
    expect((await fetchPosSale(admin, sale.id))?.number).toBe(sale.number);
  });
});

describe("company details for printed documents", () => {
  it("are readable by every role and changed only by an admin", async () => {
    const before = await fetchSettings(prodavac);
    expect(before).toHaveProperty("company_bank_account");

    const { data: bySeller } = await prodavac.from("settings").update({ company_phone: "000" }).eq("id", true).select("id");
    expect(bySeller ?? []).toHaveLength(0);
    const { data: byManager } = await menadzer.from("settings").update({ company_phone: "000" }).eq("id", true).select("id");
    expect(byManager ?? []).toHaveLength(0);

    const { data: byAdmin, error } = await admin
      .from("settings")
      .update({ company_phone: "033 123 456" })
      .eq("id", true)
      .select("company_phone");
    expect(error).toBeNull();
    expect(byAdmin).toEqual([{ company_phone: "033 123 456" }]);

    await admin.from("settings").update({ company_phone: before.company_phone }).eq("id", true);
  });

  it("rejects a bank account with letters in the database too", async () => {
    const { error } = await admin.from("settings").update({ company_bank_account: "BA39 1610" }).eq("id", true);
    expect(error?.code).toBe("23514");
  });
});
