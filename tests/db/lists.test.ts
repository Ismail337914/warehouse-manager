import { beforeAll, describe, expect, it } from "vitest";

import { fetchCustomers } from "@/lib/queries/customers";
import { fetchActiveReservations, fetchOrders } from "@/lib/queries/orders";
import { findProductByCode, searchPosProducts } from "@/lib/queries/pos";
import { fetchProcurementDocs } from "@/lib/queries/procurement";
import { fetchListings } from "@/lib/queries/listings";
import { fetchProductMovements, fetchProducts } from "@/lib/queries/products";

import { anonClient, signInAs, testUsers } from "./helpers";

type Client = Awaited<ReturnType<typeof signInAs>>;

const productParams = { q: "", category: "", status: "", location: "", sort: "name", page: 1 };
let menadzer: Client;
let prodavac: Client;

beforeAll(async () => {
  [menadzer, prodavac] = await Promise.all([signInAs("menadzer"), signInAs("prodavac")]);
});

describe("products list", () => {
  it("searches by name, SKU, barcode and OEM number in the database", async () => {
    expect((await fetchProducts(prodavac, { ...productParams, q: "kamera" })).rows.map((row) => row.id)).toEqual(["PRD-7781"]);
    expect((await fetchProducts(prodavac, { ...productParams, q: "sku-1045" })).rows.map((row) => row.id)).toEqual(["PRD-1045"]);
    expect((await fetchProducts(prodavac, { ...productParams, q: "3870000051026" })).rows.map((row) => row.id)).toEqual(["PRD-5102"]);
    expect((await fetchProducts(prodavac, { ...productParams, q: "OEM-LTP-14" })).rows.map((row) => row.id)).toEqual(["PRD-1021"]);
  });

  it("matches POS products by OEM number, including exact-code lookup", async () => {
    expect((await searchPosProducts(prodavac, "oem-cam-4mp")).map((row) => row.id)).toEqual(["PRD-7781"]);
    expect((await findProductByCode(prodavac, "OEM-CAM-4MP"))?.id).toBe("PRD-7781");
  });

  it("filters by low stock and status", async () => {
    const low = await fetchProducts(prodavac, { ...productParams, status: "low" });
    expect(low.rows.every((row) => row.quantity <= row.min_quantity)).toBe(true);
    expect(low.rows.map((row) => row.id)).toEqual(expect.arrayContaining(["PRD-1045", "PRD-5102"]));

    const inactive = await fetchProducts(prodavac, { ...productParams, status: "inactive" });
    expect(inactive.rows.map((row) => row.id)).toEqual(["PRD-8120"]);
  });

  it("filters by warehouse location and supports selectable sorting", async () => {
    const atLocation = await fetchProducts(prodavac, { ...productParams, location: "S-01-A" });
    expect(atLocation.rows.map((row) => row.id)).toEqual(["PRD-1021"]);

    const byPrice = await fetchProducts(prodavac, { ...productParams, sort: "price" });
    expect(byPrice.rows[0]?.id).toBe("PRD-1021");
  });

  it("returns one page at a time with the total count", async () => {
    const prefix = `PAG-${crypto.randomUUID().slice(0, 6)}`;
    const { data: category } = await menadzer.from("categories").select("id").limit(1).single();
    const { error } = await menadzer.from("products").insert(
      Array.from({ length: 25 }, (_, index) => ({
        sku: `${prefix}-${String(index).padStart(2, "0")}`,
        name: `${prefix} proizvod ${String(index).padStart(2, "0")}`,
        category_id: category!.id,
        buy_price: 1,
        sell_price: 2,
        location: "TEST",
      })),
    );
    expect(error).toBeNull();

    const first = await fetchProducts(prodavac, { ...productParams, q: prefix, page: 1 });
    const second = await fetchProducts(prodavac, { ...productParams, q: prefix, page: 2 });
    expect(first.total).toBe(25);
    expect(first.rows).toHaveLength(20);
    expect(second.rows).toHaveLength(5);
    const ids = new Set([...first.rows, ...second.rows].map((row) => row.id));
    expect(ids.size).toBe(25);
  });

  it("does not break on characters that are special in filters", async () => {
    await expect(fetchProducts(prodavac, { ...productParams, q: "a,b),id.eq.1(%_*" })).resolves.toMatchObject({ total: 0 });
  });

  it("shows a product's movement history newest first", async () => {
    const history = await fetchProductMovements(menadzer, "PRD-1021", 1);
    // Seller's POS sale, delivery of SO-1024, its reservation, initial receipt.
    expect(history.rows.map((row) => row.type)).toEqual(["izlaz", "izlaz", "rezervacija", "prijem"]);
  });

  it("shows a seller only the movements of their own sales and orders", async () => {
    const history = await fetchProductMovements(prodavac, "PRD-1021", 1);
    expect(history.rows.map((row) => [row.type, row.source_type])).toEqual([["izlaz", "pos_prodaja"]]);
  });
});

describe("customers list", () => {
  it("finds a company by JIB and filters by customer type", async () => {
    expect((await fetchCustomers(prodavac, { q: "4200000000025", type: "", page: 1 })).rows.map((row) => row.name)).toEqual([
      "Mediatron BH",
    ]);
    const companies = await fetchCustomers(prodavac, { q: "", type: "pravno", page: 1 });
    expect(companies.rows.every((row) => row.customer_type === "pravno")).toBe(true);
  });
});

describe("procurement list", () => {
  it("loads procurement documents and supplier names from the database", async () => {
    const documents = await fetchProcurementDocs(menadzer);
    expect(documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          document_number: "PO-210",
          supplier: expect.objectContaining({ name: "TechNord d.o.o." }),
        }),
      ]),
    );
  });
});

describe("manual listings", () => {
  it("lets staff track product listings but refuses access to sellers", async () => {
    const { error: insertError } = await menadzer.from("listings").insert({
      product_id: "PRD-1021",
      channel: "web",
      external_id: `test-${crypto.randomUUID()}`,
      url: "",
      price: 12,
    });
    expect(insertError).toBeNull();
    expect(await fetchListings(menadzer)).toEqual(
      expect.arrayContaining([expect.objectContaining({ product_id: "PRD-1021", channel: "web", status: "nacrt" })]),
    );
    const { data: sellerRows, error } = await prodavac.from("listings").select("id").limit(1);
    expect(error).toBeNull();
    expect(sellerRows).toEqual([]);
  });
});

describe("orders list and reservations", () => {
  it("finds orders by customer name or number and filters by status", async () => {
    expect((await fetchOrders(menadzer, { q: "Mediatron", status: "", page: 1 })).rows.map((row) => row.number)).toContain("SO-1025");
    expect((await fetchOrders(menadzer, { q: "SO-1026", status: "", page: 1 })).rows.map((row) => row.number)).toEqual(["SO-1026"]);
    const drafts = await fetchOrders(menadzer, { q: "", status: "nacrt", page: 1 });
    expect(drafts.rows.every((row) => row.status === "nacrt")).toBe(true);
  });

  it("lists the stock reserved by confirmed orders", async () => {
    const reservations = await fetchActiveReservations(menadzer);
    expect(reservations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ order_number: "SO-1025", product_id: "PRD-7781", quantity: 2 }),
        expect.objectContaining({ order_number: "SO-1027", product_id: "PRD-3051", quantity: 2 }),
      ]),
    );
  });

  it("shows a seller only their own orders and reservations", async () => {
    // Other test files add orders for the seller too, so check ownership rather than an exact list.
    const own = await fetchOrders(prodavac, { q: "", status: "", page: 1 });
    expect(own.rows.every((row) => row.assigned_to === testUsers.prodavac.id)).toBe(true);
    expect((await fetchOrders(prodavac, { q: "SO-1028", status: "", page: 1 })).rows.map((row) => row.number)).toEqual(["SO-1028"]);
    expect((await fetchOrders(prodavac, { q: "SO-1025", status: "", page: 1 })).total).toBe(0);

    const reservations = (await fetchActiveReservations(prodavac)).map((row) => row.order_number);
    expect(reservations).toContain("SO-1028");
    expect(reservations).not.toContain("SO-1025");
    expect(reservations).not.toContain("SO-1027");
  });
});

describe("row level security on lists", () => {
  it("refuses the same queries to a signed-out visitor", async () => {
    // The anon role has no table privileges at all, so the API answers with an error, not an empty list.
    const anon = anonClient();
    await expect(fetchProducts(anon, productParams)).rejects.toThrow();
    await expect(fetchCustomers(anon, { q: "", type: "", page: 1 })).rejects.toThrow();
    await expect(fetchOrders(anon, { q: "", status: "", page: 1 })).rejects.toThrow();
    await expect(fetchActiveReservations(anon)).rejects.toThrow();
  });

  it("lets a seller add customers but not edit or delete them; a manager edits", async () => {
    const { data: customer } = await prodavac
      .from("customers")
      .insert({ name: "Lista test d.o.o.", customer_type: "pravno", jib: `42${String(Date.now()).slice(-11)}` })
      .select("id")
      .single();
    expect(customer).not.toBeNull();

    const { data: notUpdated } = await prodavac.from("customers").update({ city: "Zenica" }).eq("id", customer!.id).select("city");
    expect(notUpdated ?? []).toEqual([]);
    const { data: updated } = await menadzer.from("customers").update({ city: "Zenica" }).eq("id", customer!.id).select("city");
    expect(updated).toEqual([{ city: "Zenica" }]);

    const { data: deleted } = await prodavac.from("customers").delete().eq("id", customer!.id).select();
    expect(deleted ?? []).toHaveLength(0);
  });

  it("rejects a company without a JIB in the database too", async () => {
    const { error } = await prodavac.from("customers").insert({ name: "Bez JIB-a d.o.o.", customer_type: "pravno" });
    expect(error?.code).toBe("23514");
  });
});
