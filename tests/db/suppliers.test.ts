import { beforeAll, describe, expect, it } from "vitest";

import { fetchCategoryList, fetchSupplierList } from "@/lib/queries/products";

import { anonClient, createTestProduct, newKey, signInAs } from "./helpers";

type Client = Awaited<ReturnType<typeof signInAs>>;

let admin: Client;
let menadzer: Client;
let prodavac: Client;

beforeAll(async () => {
  [admin, menadzer, prodavac] = await Promise.all([signInAs("admin"), signInAs("menadzer"), signInAs("prodavac")]);
});

const uniqueJib = () => `42${String(Date.now()).slice(-8)}${Math.floor(Math.random() * 900 + 100)}`;

describe("suppliers", () => {
  it("can be added, edited and deleted by staff with their company details", async () => {
    const jib = uniqueJib();
    const { data: created, error } = await menadzer
      .from("suppliers")
      .insert({ name: `Dobavljač ${jib}`, jib, pdv_number: jib.slice(1), city: "Tuzla", email: "nabava@test.ba" })
      .select("id, jib, city")
      .single();
    expect(error).toBeNull();
    expect(created).toMatchObject({ jib, city: "Tuzla" });

    const { data: updated } = await menadzer.from("suppliers").update({ phone: "035 111 222" }).eq("id", created!.id).select("phone");
    expect(updated).toEqual([{ phone: "035 111 222" }]);

    const list = await fetchSupplierList(menadzer);
    expect(list.map((supplier) => supplier.id)).toContain(created!.id);

    const { data: deleted } = await admin.from("suppliers").delete().eq("id", created!.id).select("id");
    expect(deleted).toEqual([{ id: created!.id }]);
  });

  it("rejects an invalid JIB, a duplicate JIB and an invalid e-mail in the database too", async () => {
    const jib = uniqueJib();
    expect((await menadzer.from("suppliers").insert({ name: `Loš JIB ${jib}`, jib: "123" })).error?.code).toBe("23514");
    expect((await menadzer.from("suppliers").insert({ name: `Loš e-mail ${jib}`, email: "nabava" })).error?.code).toBe("23514");

    expect((await menadzer.from("suppliers").insert({ name: `Prvi ${jib}`, jib })).error).toBeNull();
    const duplicate = await menadzer.from("suppliers").insert({ name: `Drugi ${jib}`, jib });
    expect(duplicate.error?.code).toBe("23505");
    expect(duplicate.error?.message).toContain("suppliers_jib_key");
  });

  it("can't be deleted while goods receipts reference them", async () => {
    // A supplier of its own with one receipt, so no other seeded document (e.g. purchasing) is involved.
    const { data: supplier } = await menadzer.from("suppliers").insert({ name: `S prijemom ${uniqueJib()}` }).select("id").single();
    const productId = await createTestProduct(menadzer, 0);
    const { error: receiveError } = await menadzer.rpc("receive_stock", {
      p_idempotency_key: newKey(),
      p_supplier_id: supplier!.id,
      p_document_number: "OTP-TEST",
      p_note: "",
      p_items: [{ product_id: productId, quantity: 1, unit_cost: 10 }],
    });
    expect(receiveError).toBeNull();

    const { error } = await admin.from("suppliers").delete().eq("id", supplier!.id);
    expect(error?.code).toBe("23503");
    expect(error?.message).toContain("goods_receipts_supplier_id_fkey");
  });

  it("are hidden from and read-only for sellers", async () => {
    expect(await fetchSupplierList(prodavac)).toEqual([]);
    const { error } = await prodavac.from("suppliers").insert({ name: `Prodavač ${uniqueJib()}` });
    expect(error?.code).toBe("42501");
  });
});

describe("categories", () => {
  it("can be renamed, and deleted only while they have no products", async () => {
    const name = `Kategorija ${uniqueJib()}`;
    const { data: category } = await menadzer.from("categories").insert({ name }).select("id").single();

    const { data: renamed } = await menadzer
      .from("categories")
      .update({ name: `${name} (nova)` })
      .eq("id", category!.id)
      .select("name");
    expect(renamed).toEqual([{ name: `${name} (nova)` }]);

    const list = await fetchCategoryList(menadzer);
    expect(list.find((row) => row.id === category!.id)?.productCount).toBe(0);

    const { data: deleted } = await menadzer.from("categories").delete().eq("id", category!.id).select("id");
    expect(deleted).toEqual([{ id: category!.id }]);
  });

  it("with products can't be deleted", async () => {
    const list = await fetchCategoryList(menadzer);
    const used = list.find((row) => row.productCount > 0);
    expect(used).toBeDefined();

    const { error } = await admin.from("categories").delete().eq("id", used!.id);
    expect(error?.code).toBe("23503");
    expect(error?.message).toContain("products_category_id_fkey");
  });

  it("can't be changed by sellers", async () => {
    const { data } = await prodavac.from("categories").update({ name: "Prodavač" }).eq("name", "Elektronika").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});

describe("employee directory", () => {
  it("lists every account with its role for admins and managers", async () => {
    for (const client of [admin, menadzer]) {
      const { data, error } = await client.rpc("employee_directory");
      expect(error).toBeNull();
      expect(data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ email: "admin@demo.ba", role: "admin", is_active: true }),
          expect.objectContaining({ email: "prodavac@demo.ba", role: "prodavac" }),
        ]),
      );
    }
  });

  it("is refused to sellers and visitors", async () => {
    expect((await prodavac.rpc("employee_directory")).error?.code).toBe("42501");
    expect((await anonClient().rpc("employee_directory")).error).not.toBeNull();
  });
});
