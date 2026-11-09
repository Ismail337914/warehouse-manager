import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient, createTestProduct, newKey, serviceClient, signInAs, testUsers } from "./helpers";

type Client = Awaited<ReturnType<typeof signInAs>>;

let admin: Client;
let menadzer: Client;
let prodavac: Client;
const service = serviceClient();

beforeAll(async () => {
  [admin, menadzer, prodavac] = await Promise.all([signInAs("admin"), signInAs("menadzer"), signInAs("prodavac")]);
});

async function createOrder(client: Client, productId: string) {
  const { data, error } = await client.rpc("create_order", {
    p_idempotency_key: newKey(),
    p_customer_id: "CUS-1001",
    p_source: "web",
    p_note: "RBAC test",
    p_items: [{ product_id: productId, quantity: 1 }],
  });
  if (error) throw new Error(error.message);
  return data as { id: string; number: string };
}

async function sell(client: Client, productId: string) {
  const { data, error } = await client.rpc("complete_pos_sale", {
    p_idempotency_key: newKey(),
    p_customer_id: "CUS-1002",
    p_payment_method: "gotovina",
    p_discount_percent: 0,
    p_items: [{ product_id: productId, quantity: 1 }],
  });
  if (error) throw new Error(error.message);
  return data as { id: string; total: number };
}

const statusOf = async (orderId: string) =>
  (await service.from("orders").select("status").eq("id", orderId).single()).data?.status;

describe("a seller works only with their own documents", () => {
  it("can't see or process another user's order, and the order stays unchanged", async () => {
    const productId = await createTestProduct(menadzer, 5);
    const order = await createOrder(menadzer, productId);

    expect((await prodavac.from("orders").select("id").eq("id", order.id)).data).toEqual([]);
    expect((await prodavac.from("order_items").select("product_id").eq("order_id", order.id)).data).toEqual([]);

    for (const fn of ["confirm_order", "cancel_order"] as const) {
      const args = { p_idempotency_key: newKey(), p_order_id: order.id, ...(fn === "cancel_order" ? { p_reason: "" } : {}) };
      const { error } = await prodavac.rpc(fn, args as never);
      expect(error?.message, fn).toContain("Nemate pristup");
    }
    expect(await statusOf(order.id)).toBe("nacrt");
    expect((await service.from("products").select("reserved_quantity").eq("id", productId).single()).data).toEqual({
      reserved_quantity: 0,
    });
  });

  it("gets an order once a manager assigns it, and can then process it", async () => {
    const productId = await createTestProduct(menadzer, 5);
    const order = await createOrder(menadzer, productId);

    expect((await prodavac.rpc("assign_order", { p_order_id: order.id, p_user_id: testUsers.prodavac.id })).error?.message).toContain(
      "Nemate ovlasti",
    );
    expect((await menadzer.rpc("assign_order", { p_order_id: order.id, p_user_id: testUsers.prodavac.id })).error).toBeNull();

    expect((await prodavac.from("orders").select("id, assigned_to").eq("id", order.id)).data).toEqual([
      { id: order.id, assigned_to: testUsers.prodavac.id },
    ]);
    expect((await prodavac.rpc("confirm_order", { p_idempotency_key: newKey(), p_order_id: order.id })).error).toBeNull();
    expect(await statusOf(order.id)).toBe("potvrđena");
  });

  it("lists assignable users only for staff", async () => {
    expect((await prodavac.rpc("assignable_users")).error?.message).toContain("Nemate ovlasti");
    const { data } = await menadzer.rpc("assignable_users");
    expect(data?.map((user) => user.id)).toEqual(expect.arrayContaining([testUsers.prodavac.id, testUsers.admin.id]));
  });

  it("can't see or invoice another user's POS sale", async () => {
    const productId = await createTestProduct(menadzer, 5);
    const sale = await sell(menadzer, productId);

    expect((await prodavac.from("pos_sales").select("id").eq("id", sale.id)).data).toEqual([]);
    expect((await prodavac.from("pos_sale_items").select("product_id").eq("pos_sale_id", sale.id)).data).toEqual([]);
    const { error } = await prodavac.rpc("invoice_pos_sale", { p_idempotency_key: newKey(), p_pos_sale_id: sale.id });
    expect(error?.message).toContain("Nemate pristup");

    const own = await sell(prodavac, productId);
    expect((await prodavac.from("pos_sales").select("id").eq("id", own.id)).data).toEqual([{ id: own.id }]);
  });

  it("can't see invoices, lines or payments of other users' orders", async () => {
    const productId = await createTestProduct(menadzer, 5);
    const order = await createOrder(menadzer, productId);
    for (const fn of ["confirm_order", "deliver_order"] as const) {
      await menadzer.rpc(fn, { p_idempotency_key: newKey(), p_order_id: order.id });
    }
    const { data: invoice } = await menadzer.rpc("invoice_order", { p_idempotency_key: newKey(), p_order_id: order.id });
    const invoiceId = (invoice as { id: string }).id;
    await menadzer.rpc("record_payment", {
      p_idempotency_key: newKey(),
      p_invoice_id: invoiceId,
      p_amount: 10,
      p_method: "virman",
      p_paid_on: null as unknown as string,
      p_note: "",
    });

    expect((await prodavac.from("invoices").select("id").eq("id", invoiceId)).data).toEqual([]);
    expect((await prodavac.from("invoice_items").select("product_id").eq("invoice_id", invoiceId)).data).toEqual([]);
    expect((await prodavac.from("payments").select("id").eq("invoice_id", invoiceId)).data).toEqual([]);
    expect((await menadzer.from("payments").select("id").eq("invoice_id", invoiceId)).data).toHaveLength(1);
  });

  it("sees only their own results on the dashboard", async () => {
    const before = (await prodavac.rpc("dashboard_summary")).data as { scope: string; revenue_today: number };
    const adminBefore = (await admin.rpc("dashboard_summary")).data as { scope: string; revenue_today: number };
    expect(before.scope).toBe("own");
    expect(adminBefore.scope).toBe("all");

    const productId = await createTestProduct(menadzer, 5);
    const sale = await sell(menadzer, productId);

    const after = (await prodavac.rpc("dashboard_summary")).data as { revenue_today: number };
    const adminAfter = (await admin.rpc("dashboard_summary")).data as { revenue_today: number };
    expect(after.revenue_today).toBe(before.revenue_today);
    expect(adminAfter.revenue_today).toBeCloseTo(adminBefore.revenue_today + sale.total, 2);
  });
});

describe("staff-only data", () => {
  it("hides purchasing, stock documents, employees and suppliers from sellers", async () => {
    for (const table of ["goods_receipts", "goods_receipt_items", "stock_counts", "employees", "suppliers", "procurement_docs"] as const) {
      const { data } = await prodavac.from(table).select("*").limit(1);
      expect(data ?? [], table).toEqual([]);
    }
    expect((await menadzer.from("goods_receipts").select("id").limit(1)).data).toHaveLength(1);
    expect((await menadzer.from("employees").select("id").limit(1)).data).toHaveLength(1);
  });

  it("never returns purchase prices through the API; staff read them with product_costs", async () => {
    const column = await prodavac.from("products").select("id, buy_price").eq("id", "PRD-1021");
    expect(column.error?.code).toBe("42501");
    expect((await prodavac.rpc("product_costs", { p_ids: ["PRD-1021"] })).error?.message).toContain("Nemate ovlasti");

    const { data } = await menadzer.rpc("product_costs", { p_ids: ["PRD-1021"] });
    expect(data).toEqual([{ id: "PRD-1021", buy_price: 980 }]);
  });

  it("still lets sellers read sale prices and availability", async () => {
    const { data } = await prodavac.from("products").select("id, sell_price, available_quantity").eq("id", "PRD-1021").single();
    expect(data?.sell_price).toBe(1299);
  });
});

describe("roles and the audit log", () => {
  afterAll(async () => {
    await service.from("profiles").update({ role: "prodavac" }).eq("id", testUsers.prodavac.id);
  });

  it("does not let a manager change roles", async () => {
    const { data } = await menadzer.from("profiles").update({ role: "admin" }).eq("id", testUsers.prodavac.id).select();
    expect(data ?? []).toEqual([]);
    expect((await service.from("profiles").select("role").eq("id", testUsers.prodavac.id).single()).data?.role).toBe("prodavac");
  });

  it("ignores a role a user writes into their own user metadata", async () => {
    const seller = await signInAs("prodavac");
    const { error } = await seller.auth.updateUser({ data: { role: "admin" } });
    expect(error).toBeNull();
    expect((await service.from("profiles").select("role").eq("id", testUsers.prodavac.id).single()).data?.role).toBe("prodavac");
    expect((await seller.rpc("product_costs")).error?.message).toContain("Nemate ovlasti");
    await seller.auth.updateUser({ data: { role: null } });
  });

  it("records role changes in an audit log that only admins read and nobody edits", async () => {
    await admin.from("profiles").update({ role: "menadzer" }).eq("id", testUsers.prodavac.id);

    const { data: entries } = await admin
      .from("audit_logs")
      .select("actor_id, action, entity_id, details")
      .eq("action", "korisnik.uloga")
      .eq("entity_id", testUsers.prodavac.id)
      .order("created_at", { ascending: false })
      .limit(1);
    expect(entries?.[0]).toMatchObject({
      actor_id: testUsers.admin.id,
      details: { old: "prodavac", new: "menadzer" },
    });

    expect((await menadzer.from("audit_logs").select("id").limit(1)).data).toEqual([]);
    expect((await admin.from("audit_logs").insert({ action: "x", entity: "x" })).error?.code).toBe("42501");
    const tamper = await service.from("audit_logs").delete().eq("action", "korisnik.uloga");
    expect(tamper.error?.message).toContain("ne može mijenjati");
  });
});

describe("accounts and passwords", () => {
  const created: string[] = [];

  afterAll(async () => {
    for (const id of created) await service.auth.admin.deleteUser(id);
  });

  it("refuses public sign-up", async () => {
    const { error } = await anonClient().auth.signUp({ email: `signup-${Date.now()}@demo.ba`, password: "Lozinka123" });
    expect(error).not.toBeNull();
  });

  it("gives an account without an admin-assigned role no access", async () => {
    const email = `bez-uloge-${Date.now()}@demo.ba`;
    const { data, error } = await service.auth.admin.createUser({ email, password: "Lozinka123", email_confirm: true });
    expect(error).toBeNull();
    created.push(data.user!.id);

    const { data: profile } = await service.from("profiles").select("role, is_active").eq("id", data.user!.id).single();
    expect(profile).toEqual({ role: "prodavac", is_active: false });

    const client = anonClient();
    await client.auth.signInWithPassword({ email, password: "Lozinka123" });
    expect((await client.from("products").select("id").limit(1)).data ?? []).toEqual([]);
  });

  it("applies the role an admin gives a new account (set by the admin API after the insert)", async () => {
    const email = `menadzer-${Date.now()}@demo.ba`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: "Lozinka123",
      email_confirm: true,
      app_metadata: { role: "menadzer" },
      user_metadata: { full_name: "Novi Menadžer" },
    });
    expect(error).toBeNull();
    created.push(data.user!.id);

    const { data: profile } = await service.from("profiles").select("role, is_active, full_name").eq("id", data.user!.id).single();
    expect(profile).toEqual({ role: "menadzer", is_active: true, full_name: "Novi Menadžer" });
  });

  it("accepts a password with quotes, semicolons and backslashes (it is never part of SQL)", async () => {
    const email = `specijalni-${Date.now()}@demo.ba`;
    const password = `Ab1'";--\\ x<>%`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "prodavac" },
    });
    expect(error).toBeNull();
    created.push(data.user!.id);

    const client = anonClient();
    expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
    expect((await client.from("products").select("id").limit(1)).data).toHaveLength(1);
    expect((await anonClient().auth.signInWithPassword({ email, password: `${password}x` })).error).not.toBeNull();
  });

  it("limits failed sign-ins per e-mail; only the server (service role) can use the counter", async () => {
    const emailKey = crypto.randomUUID();
    const ipKey = crypto.randomUUID();
    const args = { p_kind: "login", p_email_key: emailKey, p_ip_key: ipKey };

    expect((await service.rpc("auth_attempt_allowed", args)).data).toBe(true);
    for (let i = 0; i < 5; i++) await service.rpc("record_auth_attempt", args);
    expect((await service.rpc("auth_attempt_allowed", args)).data).toBe(false);

    await service.rpc("clear_auth_attempts", { p_kind: "login", p_email_key: emailKey });
    expect((await service.rpc("auth_attempt_allowed", args)).data).toBe(true);

    expect((await prodavac.rpc("auth_attempt_allowed", args)).error).not.toBeNull();
    expect((await anonClient().rpc("record_auth_attempt", args)).error).not.toBeNull();
  });
});

describe("signed-out visitors", () => {
  it("read nothing from the new tables either", async () => {
    const anon = anonClient();
    for (const table of ["pos_sales", "invoices", "payments", "audit_logs", "goods_receipts"] as const) {
      const { data } = await anon.from(table).select("*").limit(1);
      expect(data ?? [], table).toEqual([]);
    }
    expect((await anon.rpc("dashboard_summary")).error).not.toBeNull();
  });
});
