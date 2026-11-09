import { beforeAll, describe, expect, it } from "vitest";

import { createTestProduct, signInAs } from "./helpers";

type Client = Awaited<ReturnType<typeof signInAs>>;

let menadzer: Client;
let prodavac: Client;

beforeAll(async () => {
  [menadzer, prodavac] = await Promise.all([signInAs("menadzer"), signInAs("prodavac")]);
});

// Rules the Server Actions check with Zod must hold for direct API writes too (security_hardening.sql).
describe("direct API writes", () => {
  it("can't choose a customer's id or timestamps", async () => {
    const { error } = await prodavac
      .from("customers")
      .insert({ id: "CUS-9999", name: "Odabrani ID", customer_type: "fizicko" });
    expect(error?.code).toBe("42501");

    const { data, error: allowed } = await prodavac
      .from("customers")
      .insert({ name: `Kupac ${Date.now()}`, customer_type: "fizicko" })
      .select("id")
      .single();
    expect(allowed).toBeNull();
    expect(data?.id).toMatch(/^CUS-\d+$/);
  });

  it("can't choose a supplier's id", async () => {
    const { error } = await menadzer.from("suppliers").insert({ id: "SUP-9999", name: `Odabrani ID ${Date.now()}` });
    expect(error?.code).toBe("42501");
  });

  it("rejects NaN prices that would pass a >= 0 check", async () => {
    const productId = await createTestProduct(menadzer, 0);
    const { error } = await menadzer.from("products").update({ sell_price: "NaN" as unknown as number }).eq("id", productId);
    expect(error?.code).toBe("23514");
  });

  it("stores only http(s) links for listings", async () => {
    const productId = await createTestProduct(menadzer, 0);
    const bad = await menadzer
      .from("listings")
      .insert({ product_id: productId, channel: "olx", url: "javascript:alert(1)", price: 10 });
    expect(bad.error?.code).toBe("23514");

    const good = await menadzer
      .from("listings")
      .insert({ product_id: productId, channel: "olx", url: "https://www.olx.ba/artikal/1", price: 10 });
    expect(good.error).toBeNull();
  });
});
