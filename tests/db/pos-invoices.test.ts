import { beforeAll, describe, expect, it } from "vitest";

import { documentTotals } from "@/lib/money";
import { currentMonthKey, monthRange } from "@/lib/month";

import { createTestProduct, movementsOf, newKey, serviceClient, signInAs, stockOf } from "./helpers";

type Client = Awaited<ReturnType<typeof signInAs>>;
type PosResult = { id: string; number: string; subtotal: number; vat_total: number; total: number };
type InvoiceResult = { id: string; number: string; status: string; total: number; paid_amount: number; storno_of: string | null };

let admin: Client;
let menadzer: Client;
let prodavac: Client;

beforeAll(async () => {
  [admin, menadzer, prodavac] = await Promise.all([signInAs("admin"), signInAs("menadzer"), signInAs("prodavac")]);
});

const sell = (
  client: Client,
  items: Array<{ product_id: string; quantity: number }>,
  { key = newKey(), discount = 0, customerId = "CUS-1002" }: { key?: string; discount?: number; customerId?: string } = {},
) =>
  client.rpc("complete_pos_sale", {
    p_idempotency_key: key,
    p_customer_id: customerId,
    p_payment_method: "gotovina",
    p_discount_percent: discount,
    p_items: items,
  });

const invoiceOrder = (client: Client, orderId: string, key = newKey()) =>
  client.rpc("invoice_order", { p_idempotency_key: key, p_order_id: orderId });

const pay = (client: Client, invoiceId: string, amount: number) =>
  client.rpc("record_payment", {
    p_idempotency_key: newKey(),
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_method: "virman",
    p_paid_on: null as unknown as string,
    p_note: "",
  });

const storno = (client: Client, invoiceId: string) =>
  client.rpc("storno_invoice", { p_idempotency_key: newKey(), p_invoice_id: invoiceId, p_reason: "Test" });

// A delivered order with one line, ready to be invoiced.
async function deliveredOrder(quantity = 2, sellPrice = 100) {
  const productId = await createTestProduct(menadzer, 10, sellPrice);
  const { data: order, error } = await prodavac.rpc("create_order", {
    p_idempotency_key: newKey(),
    p_customer_id: "CUS-1001",
    p_source: "web",
    p_note: "Test",
    p_items: [{ product_id: productId, quantity }],
  });
  if (error) throw new Error(error.message);
  const orderId = (order as { id: string }).id;
  for (const fn of ["confirm_order", "deliver_order"] as const) {
    const { error: stepError } = await prodavac.rpc(fn, { p_idempotency_key: newKey(), p_order_id: orderId });
    if (stepError) throw new Error(stepError.message);
  }
  return orderId;
}

async function issue(client: Client, orderId: string) {
  const { data, error } = await invoiceOrder(client, orderId);
  if (error) throw new Error(error.message);
  return data as InvoiceResult;
}

const sequenceOf = (number: string) => Number(number.split("/")[0].replace(/^P-/, ""));

describe("POS sale", () => {
  it("books a double click (same key, concurrent) as one sale and removes stock once", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const key = newKey();
    const [first, second] = await Promise.all([
      sell(prodavac, [{ product_id: productId, quantity: 3 }], { key }),
      sell(prodavac, [{ product_id: productId, quantity: 3 }], { key }),
    ]);

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect((second.data as PosResult).id).toBe((first.data as PosResult).id);
    expect(await stockOf(productId)).toEqual({ quantity: 7, reserved_quantity: 0, available_quantity: 7 });

    const { count } = await serviceClient()
      .from("pos_sale_items")
      .select("*", { count: "exact", head: true })
      .eq("product_id", productId);
    expect(count).toBe(1);
  });

  it("writes the receipt number, database prices and an izlaz movement", async () => {
    const productId = await createTestProduct(menadzer, 10, 33.33);
    const { data, error } = await sell(menadzer, [{ product_id: productId, quantity: 3 }], { discount: 7.5 });
    expect(error).toBeNull();

    const sale = data as PosResult;
    expect(sale.number).toMatch(/^P-\d{4,}\/\d{4}$/);
    const expected = documentTotals([{ quantity: 3, unitPrice: 33.33, discountPercent: 7.5, vatRate: 17 }]);
    expect({ net: sale.subtotal, vat: sale.vat_total, gross: sale.total }).toEqual(expected);
    expect(await movementsOf(productId)).toContainEqual({
      type: "izlaz",
      on_hand_change: -3,
      reserved_change: 0,
      source_type: "pos_prodaja",
      source_id: sale.id,
    });
  });

  it("rejects a discount above the seller's limit from settings", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const tooHigh = await sell(prodavac, [{ product_id: productId, quantity: 1 }], { discount: 15 });
    expect(tooHigh.error?.message).toContain("Popust može biti najviše 10");

    // A manager's limit is higher (30 %).
    expect((await sell(menadzer, [{ product_id: productId, quantity: 1 }], { discount: 15 })).error).toBeNull();
    expect((await stockOf(productId)).quantity).toBe(9);
  });

  it("never sells stock reserved by a confirmed order", async () => {
    const productId = await createTestProduct(menadzer, 5);
    const { data: order } = await prodavac.rpc("create_order", {
      p_idempotency_key: newKey(),
      p_customer_id: "CUS-1001",
      p_source: "web",
      p_note: "",
      p_items: [{ product_id: productId, quantity: 4 }],
    });
    await prodavac.rpc("confirm_order", { p_idempotency_key: newKey(), p_order_id: (order as { id: string }).id });

    const { error } = await sell(prodavac, [{ product_id: productId, quantity: 2 }]);
    expect(error?.message).toContain("Nedovoljno dostupno");
    expect(await stockOf(productId)).toEqual({ quantity: 5, reserved_quantity: 4, available_quantity: 1 });
  });

  it("issues a paid invoice for a sale with a customer, once", async () => {
    const productId = await createTestProduct(menadzer, 10);
    const { data } = await sell(prodavac, [{ product_id: productId, quantity: 1 }]);
    const sale = data as PosResult;

    const first = await prodavac.rpc("invoice_pos_sale", { p_idempotency_key: newKey(), p_pos_sale_id: sale.id });
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ status: "placena", total: sale.total, paid_amount: sale.total });

    const second = await prodavac.rpc("invoice_pos_sale", { p_idempotency_key: newKey(), p_pos_sale_id: sale.id });
    expect(second.error?.message).toContain("već fakturisana");
  });
});

describe("invoices", () => {
  it("can't invoice the same order twice, even concurrently", async () => {
    const orderId = await deliveredOrder();
    const results = await Promise.all([invoiceOrder(prodavac, orderId), invoiceOrder(menadzer, orderId)]);

    expect(results.filter((result) => result.error === null)).toHaveLength(1);
    expect(results.find((result) => result.error)?.error?.message).toContain("već fakturisana");

    const { data: invoices } = await serviceClient().from("invoices").select("id").eq("order_id", orderId);
    expect(invoices).toHaveLength(1);
    const { data: order } = await serviceClient().from("orders").select("status").eq("id", orderId).single();
    expect(order?.status).toBe("fakturisana");
  });

  it("numbers invoices consecutively, without gaps after a failed attempt", async () => {
    const [orderA, orderB] = [await deliveredOrder(), await deliveredOrder()];
    const first = await issue(prodavac, orderA);

    // A failing invoice (order not delivered) rolls back and must not use up a number.
    const productId = await createTestProduct(menadzer, 5);
    const { data: draft } = await prodavac.rpc("create_order", {
      p_idempotency_key: newKey(),
      p_customer_id: "CUS-1001",
      p_source: "web",
      p_note: "",
      p_items: [{ product_id: productId, quantity: 1 }],
    });
    expect((await invoiceOrder(prodavac, (draft as { id: string }).id)).error).not.toBeNull();

    const second = await issue(prodavac, orderB);
    expect(first.number).toMatch(/^\d{4,}\/\d{4}$/);
    expect(sequenceOf(second.number)).toBe(sequenceOf(first.number) + 1);
  });

  it("can't change or delete an issued invoice or its lines", async () => {
    const invoice = await issue(prodavac, await deliveredOrder());
    const service = serviceClient();

    const update = await service.from("invoices").update({ total: 1 }).eq("id", invoice.id);
    expect(update.error?.message).toContain("ne može mijenjati");

    const updateLine = await service.from("invoice_items").update({ quantity: 99 }).eq("invoice_id", invoice.id);
    expect(updateLine.error?.message).toContain("ne može mijenjati");

    const remove = await service.from("invoices").delete().eq("id", invoice.id);
    expect(remove.error?.message).toContain("ne može mijenjati");

    const { data: product } = await service.from("products").select("id").limit(1).single();
    const addLine = await service.from("invoice_items").insert({
      invoice_id: invoice.id,
      product_id: product!.id,
      sku: "X",
      name: "X",
      unit: "kom",
      quantity: 1,
      unit_price: 1,
      discount_percent: 0,
      vat_rate: 17,
      net_amount: 1,
      vat_amount: 0.17,
      gross_amount: 1.17,
    });
    expect(addLine.error?.message).toContain("ne može mijenjati");

    // Users can't write invoices at all, not even through the API.
    const direct = await prodavac.from("invoices").update({ note: "x" }).eq("id", invoice.id).select("id");
    expect(direct.data ?? []).toEqual([]);
  });

  it("derives the status from payments and rejects a payment above the debt", async () => {
    const invoice = await issue(prodavac, await deliveredOrder(2, 100)); // 2 × 100 + 17 % = 234.00

    expect((await pay(prodavac, invoice.id, 50)).error?.message).toContain("Nemate ovlasti");

    const partial = await pay(menadzer, invoice.id, 100);
    expect(partial.data).toMatchObject({ status: "djelimicno_placena", paid_amount: 100 });

    expect((await pay(menadzer, invoice.id, 134.01)).error?.message).toContain("veći od duga");

    const rest = await pay(menadzer, invoice.id, 134);
    expect(rest.data).toMatchObject({ status: "placena", paid_amount: 234 });
  });

  it("storno: negative document with its own number, order back to isporučena, then invoiced again", async () => {
    const orderId = await deliveredOrder(3, 50);
    const invoice = await issue(prodavac, orderId);

    // Only an admin may cancel an issued invoice.
    expect((await storno(prodavac, invoice.id)).error?.message).toContain("Nemate ovlasti");
    expect((await storno(menadzer, invoice.id)).error?.message).toContain("Nemate ovlasti");

    const { data, error } = await storno(admin, invoice.id);
    expect(error).toBeNull();
    const document = data as InvoiceResult;
    expect(document.storno_of).toBe(invoice.id);
    expect(document.total).toBe(-invoice.total);
    expect(document.number).not.toBe(invoice.number);

    const { data: lines } = await serviceClient().from("invoice_items").select("quantity").eq("invoice_id", document.id);
    expect(lines).toEqual([{ quantity: -3 }]);
    const { data: original } = await serviceClient().from("invoices").select("status").eq("id", invoice.id).single();
    expect(original?.status).toBe("stornirana");
    const { data: order } = await serviceClient().from("orders").select("status").eq("id", orderId).single();
    expect(order?.status).toBe("isporučena");

    expect((await storno(admin, invoice.id)).error?.message).toContain("već stornirana");
    const again = await issue(prodavac, orderId);
    expect(again.status).toBe("izdata");
  });

  it("refuses a storno once payments exist", async () => {
    const invoice = await issue(prodavac, await deliveredOrder());
    await pay(menadzer, invoice.id, 10);
    expect((await storno(admin, invoice.id)).error?.message).toContain("ima evidentirane uplate");
  });
});

describe("dashboard", () => {
  it("adds POS sales and invoiced orders to today's turnover and subtracts storno", async () => {
    const before = (await admin.rpc("dashboard_summary")).data as { revenue_today: number; sales_today: number };

    const productId = await createTestProduct(menadzer, 10);
    const sale = (await sell(prodavac, [{ product_id: productId, quantity: 1 }])).data as PosResult;
    const invoice = await issue(prodavac, await deliveredOrder(1, 100));
    const afterSales = (await admin.rpc("dashboard_summary")).data as { revenue_today: number; sales_today: number };

    expect(afterSales.revenue_today).toBeCloseTo(before.revenue_today + sale.total + invoice.total, 2);
    expect(afterSales.sales_today).toBe(before.sales_today + 2);

    await storno(admin, invoice.id);
    const afterStorno = (await admin.rpc("dashboard_summary")).data as { revenue_today: number; sales_today: number };
    expect(afterStorno.revenue_today).toBeCloseTo(before.revenue_today + sale.total, 2);
    expect(afterStorno.sales_today).toBe(before.sales_today + 1);
  });

  it("returns twelve months, the last one being the current month", async () => {
    const { data, error } = await prodavac.rpc("sales_by_month", { p_months: 12 });
    expect(error).toBeNull();
    expect(data).toHaveLength(12);
    const now = new Date();
    expect(data!.at(-1)!.month.slice(0, 7)).toBe(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  });

  it("shows monthly source documents whose total matches the sales chart", async () => {
    const month = currentMonthKey();
    const range = monthRange(month)!;
    const { data, error } = await admin.rpc("sales_documents_by_month", { p_month: range.start });
    expect(error).toBeNull();

    const { data: monthlySales, error: salesError } = await admin.rpc("sales_by_month", { p_months: 12 });
    expect(salesError).toBeNull();
    const chartMonth = monthlySales!.find((row) => row.month.slice(0, 7) === month);
    const detailTotal = (data as Array<{ amount: number }>).reduce((sum, row) => sum + row.amount, 0);
    expect(detailTotal).toBeCloseTo(Number(chartMonth?.revenue ?? 0), 2);
  });
});
