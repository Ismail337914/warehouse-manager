import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

export const movementTypeLabels: Record<Enums["stock_movement_type"], string> = {
  prijem: "Prijem",
  izlaz: "Izlaz",
  rezervacija: "Rezervacija",
  oslobadjanje: "Oslobađanje",
  korekcija: "Korekcija",
  inventura: "Inventura",
};

export const sourceTypeLabels: Record<Enums["stock_source_type"], string> = {
  narudzba: "Narudžba",
  pos_prodaja: "POS prodaja",
  prijem: "Prijem robe",
  korekcija: "Korekcija",
  inventura: "Inventura",
};

export const customerTypeLabels: Record<Enums["customer_type"], string> = {
  fizicko: "Fizičko lice",
  pravno: "Pravno lice",
};

export const orderSourceLabels: Record<Enums["order_source"], string> = {
  web: "Web",
  olx: "OLX",
  viber: "Viber",
  telefon: "Telefon",
  pos: "POS",
};

export const productStatusLabels: Record<Enums["product_status"], string> = {
  active: "Aktivan",
  inactive: "Neaktivan",
};

export const paymentMethodLabels: Record<Enums["payment_method"], string> = {
  gotovina: "Gotovina",
  kartica: "Kartica",
  virman: "Virman",
};

export const invoiceStatusLabels: Record<Enums["invoice_status"], string> = {
  izdata: "Izdata",
  djelimicno_placena: "Djelimično plaćena",
  placena: "Plaćena",
  stornirana: "Stornirana",
};

export const employeeStatusLabels: Record<Enums["employee_status"], string> = {
  aktivan: "Aktivan",
  odmor: "Na odmoru",
  neaktivan: "Neaktivan",
};

// Actions written by the audit triggers (supabase/migrations/*_rbac.sql).
export const auditActionLabels: Record<string, string> = {
  "korisnik.kreiran": "Korisnik kreiran",
  "korisnik.uloga": "Promjena uloge",
  "korisnik.aktiviran": "Korisnik aktiviran",
  "korisnik.deaktiviran": "Korisnik deaktiviran",
  "postavke.izmjena": "Izmjena postavki",
  "faktura.storno": "Storno fakture",
  "uplata.evidentirana": "Evidentirana uplata",
  "zalihe.korekcija": "Korekcija zaliha",
  "zalihe.inventura": "Inventura",
  "narudzba.dodjela": "Dodjela narudžbe",
  "proizvod.cijena": "Promjena cijene",
};
