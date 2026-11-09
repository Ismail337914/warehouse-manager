import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

// Seed users from supabase/seed.sql (local database only).
export const testUsers = {
  admin: { id: "00000000-0000-4000-8000-000000000001", email: "admin@demo.ba" },
  menadzer: { id: "00000000-0000-4000-8000-000000000002", email: "menadzer@demo.ba" },
  prodavac: { id: "00000000-0000-4000-8000-000000000003", email: "prodavac@demo.ba" },
} as const;

const TEST_PASSWORD = "Demo1234";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} nije postavljen. Pokrenite "npm run db:start" i popunite .env.local.`);
  return value;
}

// The tests create users' data, sell stock and use the service role key. They must never run against the
// cloud project, e.g. if .env.local was filled from Vercel by mistake.
const supabaseHost = new URL(env("NEXT_PUBLIC_SUPABASE_URL")).hostname;
if (supabaseHost !== "127.0.0.1" && supabaseHost !== "localhost") {
  throw new Error(`Testovi rade samo na lokalnoj bazi, a NEXT_PUBLIC_SUPABASE_URL pokazuje na ${supabaseHost}.`);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export function anonClient() {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), options);
}

// Bypasses RLS: only for arranging and checking test data.
export function serviceClient() {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), options);
}

export async function signInAs(role: keyof typeof testUsers) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email: testUsers[role].email, password: TEST_PASSWORD });
  if (error) throw new Error(`Prijava kao ${role} nije uspjela: ${error.message}`);
  return client;
}

export function newKey() {
  return crypto.randomUUID();
}

type Client = Awaited<ReturnType<typeof signInAs>>;

// A fresh product with a known stock, received through receive_stock so the ledger stays consistent.
export async function createTestProduct(manager: Client, stock: number, sellPrice = 100) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const { data: category } = await manager.from("categories").select("id").limit(1).single();
  const { data: product, error } = await manager
    .from("products")
    .insert({
      sku: `TEST-${suffix}`,
      name: `Test proizvod ${suffix}`,
      category_id: category!.id,
      buy_price: 50,
      sell_price: sellPrice,
      location: "TEST",
    })
    .select("id")
    .single();
  if (error || !product) throw new Error(`Test proizvod nije kreiran: ${error?.message}`);

  if (stock > 0) {
    const { error: receiveError } = await manager.rpc("receive_stock", {
      p_idempotency_key: newKey(),
      p_supplier_id: "",
      p_document_number: "TEST",
      p_note: "",
      p_items: [{ product_id: product.id, quantity: stock, unit_cost: 50 }],
    });
    if (receiveError) throw new Error(`Prijem nije uspio: ${receiveError.message}`);
  }
  return product.id;
}

export async function stockOf(productId: string) {
  const { data } = await serviceClient()
    .from("products")
    .select("quantity, reserved_quantity, available_quantity")
    .eq("id", productId)
    .single();
  return data!;
}

export async function movementsOf(productId: string) {
  const { data } = await serviceClient()
    .from("inventory_movements")
    .select("type, on_hand_change, reserved_change, source_type, source_id")
    .eq("product_id", productId)
    .order("created_at");
  return data ?? [];
}
