import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient, serviceClient, signInAs, testUsers } from "./helpers";

type Client = Awaited<ReturnType<typeof signInAs>>;

const PRODUCT_ID = "PRD-1021";
let admin: Client;
let menadzer: Client;
let prodavac: Client;

async function sellPrice() {
  const { data } = await serviceClient().from("products").select("sell_price").eq("id", PRODUCT_ID).single();
  return Number(data?.sell_price);
}

beforeAll(async () => {
  [admin, menadzer, prodavac] = await Promise.all([signInAs("admin"), signInAs("menadzer"), signInAs("prodavac")]);
});

describe("anon (not signed in)", () => {
  it("reads nothing", async () => {
    const anon = anonClient();
    for (const table of ["products", "customers", "orders", "invoices", "profiles"] as const) {
      const { data } = await anon.from(table).select("*");
      expect(data ?? [], table).toHaveLength(0);
    }
  });
});

describe("profiles and roles", () => {
  it("shows a seller only their own profile", async () => {
    const { data } = await prodavac.from("profiles").select("id");
    expect(data).toEqual([{ id: testUsers.prodavac.id }]);
  });

  it("shows an admin every profile", async () => {
    const { data } = await admin.from("profiles").select("id");
    expect(data?.length).toBeGreaterThanOrEqual(3);
  });

  it("does not let a seller make themselves admin", async () => {
    const { data } = await prodavac.from("profiles").update({ role: "admin" }).eq("id", testUsers.prodavac.id).select();
    expect(data ?? []).toHaveLength(0);

    const { data: profile } = await serviceClient().from("profiles").select("role").eq("id", testUsers.prodavac.id).single();
    expect(profile?.role).toBe("prodavac");
  });

  it("does not let an admin change their own role", async () => {
    const { error } = await admin.from("profiles").update({ role: "prodavac" }).eq("id", testUsers.admin.id);
    expect(error?.message).toContain("Ne možete mijenjati vlastitu ulogu");
  });

  it("lets an admin change someone else's role", async () => {
    const { data } = await admin.from("profiles").update({ role: "menadzer" }).eq("id", testUsers.prodavac.id).select("role");
    expect(data).toEqual([{ role: "menadzer" }]);
    await admin.from("profiles").update({ role: "prodavac" }).eq("id", testUsers.prodavac.id);
  });

  it("does not let users edit columns outside full_name, role and is_active", async () => {
    const { error } = await admin.from("profiles").update({ email: "x@demo.ba" }).eq("id", testUsers.prodavac.id);
    expect(error?.code).toBe("42501");
  });
});

describe("products", () => {
  it("lets every active role read products", async () => {
    const { data } = await prodavac.from("products").select("id");
    expect(data?.length).toBeGreaterThan(0);
  });

  it("does not let a seller change prices", async () => {
    const before = await sellPrice();
    const { data } = await prodavac.from("products").update({ sell_price: 1 }).eq("id", PRODUCT_ID).select();
    expect(data ?? []).toHaveLength(0);
    expect(await sellPrice()).toBe(before);
  });

  it("lets a manager change prices", async () => {
    const before = await sellPrice();
    const { data } = await menadzer.from("products").update({ sell_price: before + 1 }).eq("id", PRODUCT_ID).select("sell_price");
    expect(Number(data?.[0]?.sell_price)).toBe(before + 1);
    await menadzer.from("products").update({ sell_price: before }).eq("id", PRODUCT_ID);
  });

  it("does not let anyone set stock directly, not even an admin", async () => {
    // The column exists in the generated types, but the database grants no UPDATE privilege on it.
    const { error } = await admin.from("products").update({ quantity: 999 }).eq("id", PRODUCT_ID);
    expect(error?.code).toBe("42501");
  });
});

describe("customers and documents", () => {
  it("lets a seller add a customer but not delete one", async () => {
    const { data: created, error } = await prodavac.from("customers").insert({ name: "RLS test kupac" }).select("id").single();
    expect(error).toBeNull();

    const { data: deleted } = await prodavac.from("customers").delete().eq("id", created!.id).select();
    expect(deleted ?? []).toHaveLength(0);

    await serviceClient().from("customers").delete().eq("id", created!.id);
  });

  it("does not let anyone write orders directly (only through RPC functions)", async () => {
    const { error } = await admin.from("orders").insert({ customer_id: "CUS-1001", source: "web" });
    expect(error?.code).toBe("42501");
  });
});

describe("deactivated user", () => {
  const service = serviceClient();

  afterAll(async () => {
    await service.from("profiles").update({ is_active: true }).eq("id", testUsers.prodavac.id);
  });

  it("loses access immediately, even with a still-valid session", async () => {
    await service.from("profiles").update({ is_active: false }).eq("id", testUsers.prodavac.id);
    const { data } = await prodavac.from("products").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
