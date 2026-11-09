import { describe, expect, it } from "vitest";

import {
  adjustStockSchema,
  changePasswordSchema,
  createOrderSchema,
  createUserSchema,
  customerInputSchema,
  loginSchema,
  listingInputSchema,
  listingStatusSchema,
  productInputSchema,
  settingsInputSchema,
  supplierInputSchema,
  updatePasswordSchema,
} from "@/lib/schemas";

const firstError = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  result.error?.issues[0]?.message;

describe("auth schemas", () => {
  it("requires a valid e-mail and a password to sign in", () => {
    expect(loginSchema.safeParse({ email: "admin@demo.ba", password: "x" }).success).toBe(true);
    expect(firstError(loginSchema.safeParse({ email: "admin", password: "x" }))).toBe("Neispravna e-mail adresa.");
    expect(firstError(loginSchema.safeParse({ email: "admin@demo.ba", password: "" }))).toBe("Unesite lozinku.");
  });

  it("enforces the password policy from supabase/config.toml", () => {
    const check = (password: string) => updatePasswordSchema.safeParse({ password, confirmPassword: password });
    expect(check("Demo1234").success).toBe(true);
    expect(firstError(check("Ab1"))).toBe("Lozinka mora imati najmanje 8 znakova.");
    expect(firstError(check("12345678"))).toBe("Lozinka mora sadržavati slovo.");
    expect(firstError(check("abcdefgh"))).toBe("Lozinka mora sadržavati broj.");
  });

  it("requires both passwords to match", () => {
    const result = updatePasswordSchema.safeParse({ password: "Demo1234", confirmPassword: "Demo12345" });
    expect(result.error?.issues[0]).toMatchObject({ message: "Lozinke se ne podudaraju.", path: ["confirmPassword"] });
  });

  it("requires the current password and a different, valid new one to change it", () => {
    const base = { currentPassword: "Demo1234", password: "Novi12345", confirmPassword: "Novi12345" };
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
    expect(firstError(changePasswordSchema.safeParse({ ...base, currentPassword: "" }))).toBe("Unesite trenutnu lozinku.");
    expect(firstError(changePasswordSchema.safeParse({ ...base, confirmPassword: "Novi12346" }))).toBe("Lozinke se ne podudaraju.");
    expect(
      changePasswordSchema.safeParse({ ...base, password: "Demo1234", confirmPassword: "Demo1234" }).error?.issues[0],
    ).toMatchObject({ message: "Nova lozinka mora biti različita od trenutne.", path: ["password"] });
    expect(firstError(changePasswordSchema.safeParse({ ...base, password: "kratka1", confirmPassword: "kratka1" }))).toBe(
      "Lozinka mora imati najmanje 8 znakova.",
    );
  });

  it("accepts only known roles for new users", () => {
    const base = { fullName: "Test", email: "test@demo.ba", password: "Demo1234" };
    expect(createUserSchema.safeParse({ ...base, role: "prodavac" }).success).toBe(true);
    expect(firstError(createUserSchema.safeParse({ ...base, role: "superadmin" }))).toBe("Odaberite ulogu.");
  });
});

describe("business schemas", () => {
  const key = "3f0c9a52-5b1e-4c3a-9f37-0a8b2d6e1c44";

  it("accepts an optional OEM number and enforces its length", () => {
    const product = {
      sku: "SKU-1000",
      barcode: "",
      oemNumber: "",
      name: "Proizvod",
      categoryId: 1,
      description: "",
      buyPrice: 10,
      sellPrice: 12,
      vatRate: 17,
      minQuantity: 0,
      unit: "kom",
      location: "A-1",
      status: "active",
    };
    expect(productInputSchema.safeParse(product).success).toBe(true);
    expect(productInputSchema.safeParse({ ...product, oemNumber: "X".repeat(129) }).success).toBe(false);
  });

  it("validates manual listing details and statuses", () => {
    const listing = { productId: "PRD-1021", channel: "olx", externalId: "", url: "", price: 1299 };
    expect(listingInputSchema.safeParse(listing).success).toBe(true);
    expect(listingInputSchema.safeParse({ ...listing, url: "javascript:alert(1)" }).success).toBe(false);
    expect(listingInputSchema.safeParse({ ...listing, price: -1 }).success).toBe(false);
    expect(listingStatusSchema.safeParse("potrebna_izmjena").success).toBe(true);
    expect(listingStatusSchema.safeParse("sinhronizovano").success).toBe(false);
  });

  it("requires a JIB for companies but not for natural persons", () => {
    const base = { name: "Firma", jib: "", pdvNumber: "", phone: "", email: "", address: "", city: "", notes: "" };
    expect(customerInputSchema.safeParse({ ...base, customerType: "fizicko" }).success).toBe(true);
    expect(firstError(customerInputSchema.safeParse({ ...base, customerType: "pravno" }))).toBe("JIB je obavezan za pravno lice.");
    expect(customerInputSchema.safeParse({ ...base, customerType: "pravno", jib: "4200000000017" }).success).toBe(true);
    expect(firstError(customerInputSchema.safeParse({ ...base, customerType: "pravno", jib: "123" }))).toBe(
      "JIB mora imati tačno 13 cifara.",
    );
  });

  it("validates order lines but never accepts prices from the client", () => {
    const order = {
      idempotencyKey: key,
      customerId: "CUS-1001",
      source: "web",
      note: "",
      items: [{ productId: "PRD-1021", quantity: 2, discountPercent: 0, unitPrice: 1 }],
    };
    const parsed = createOrderSchema.safeParse(order);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.items[0]).not.toHaveProperty("unitPrice");

    expect(firstError(createOrderSchema.safeParse({ ...order, items: [] }))).toBe("Dodajte barem jednu stavku.");
    expect(
      firstError(createOrderSchema.safeParse({ ...order, items: [{ productId: "PRD-1021", quantity: 0, discountPercent: 0 }] })),
    ).toBe("Količina mora biti veća od 0.");
    expect(
      firstError(createOrderSchema.safeParse({ ...order, items: [{ productId: "PRD-1021", quantity: 1, discountPercent: 120 }] })),
    ).toBe("Postotak može biti najviše 100.");
    expect(firstError(createOrderSchema.safeParse({ ...order, idempotencyKey: "abc" }))).toBe("Neispravan ključ operacije.");
  });

  it("validates suppliers like customers: JIB, PDV broj and e-mail are optional but must be valid", () => {
    const base = { name: "TechNord d.o.o.", jib: "", pdvNumber: "", address: "", city: "", phone: "", email: "", note: "" };
    expect(supplierInputSchema.safeParse(base).success).toBe(true);
    expect(
      supplierInputSchema.safeParse({ ...base, jib: "4200000000017", pdvNumber: "200000000017", email: "nabava@technord.ba" }).success,
    ).toBe(true);
    expect(firstError(supplierInputSchema.safeParse({ ...base, name: "  " }))).toBe("Naziv dobavljača je obavezan.");
    expect(firstError(supplierInputSchema.safeParse({ ...base, jib: "123" }))).toBe("JIB mora imati tačno 13 cifara.");
    expect(firstError(supplierInputSchema.safeParse({ ...base, pdvNumber: "12" }))).toBe("PDV broj mora imati tačno 12 cifara.");
    expect(firstError(supplierInputSchema.safeParse({ ...base, email: "nabava" }))).toBe("Neispravna e-mail adresa.");
  });

  it("validates the company details printed on receipts and invoices", () => {
    const base = {
      companyName: "Firma d.o.o.",
      companyAddress: "",
      companyJib: "",
      companyPdvNumber: "",
      companyCity: "",
      companyPhone: "",
      companyEmail: "",
      companyBankAccount: "",
      receiptFooter: "",
      defaultVatRate: 17,
      maxDiscountProdavac: 10,
      maxDiscountMenadzer: 30,
      invoiceDueDays: 15,
    };
    expect(settingsInputSchema.safeParse(base).success).toBe(true);
    expect(
      settingsInputSchema.safeParse({ ...base, companyBankAccount: "1610 0000 1234 5678", companyEmail: "info@firma.ba" }).success,
    ).toBe(true);
    expect(firstError(settingsInputSchema.safeParse({ ...base, companyBankAccount: "BA39 1610" }))).toBe(
      "Žiro račun smije sadržavati samo cifre, razmake i crtice.",
    );
    expect(firstError(settingsInputSchema.safeParse({ ...base, companyEmail: "info" }))).toBe("Neispravna e-mail adresa.");
    expect(firstError(settingsInputSchema.safeParse({ ...base, receiptFooter: "x".repeat(501) }))).toBe("Najviše 500 znakova.");
  });

  it("requires a reason and a non-zero change for stock corrections", () => {
    const base = { idempotencyKey: key, productId: "PRD-1021", quantityChange: -2, reason: "Oštećeno" };
    expect(adjustStockSchema.safeParse(base).success).toBe(true);
    expect(firstError(adjustStockSchema.safeParse({ ...base, quantityChange: 0 }))).toBe("Promjena količine ne može biti 0.");
    expect(firstError(adjustStockSchema.safeParse({ ...base, reason: "  " }))).toBe("Razlog korekcije je obavezan.");
  });
});
