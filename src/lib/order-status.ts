import type { Database } from "@/lib/supabase/database.types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

// Same transitions as private.order_transition_allowed in the database, which enforces them. The UI uses
// this copy only to decide which buttons to show. The database also allows fakturisana → isporučena, but only
// storno_invoice makes that move, so it is not a user action here.
export const orderTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  nacrt: ["potvrđena", "otkazana"],
  potvrđena: ["isporučena", "otkazana"],
  isporučena: ["fakturisana"],
  fakturisana: [],
  otkazana: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return orderTransitions[from].includes(to);
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  nacrt: "Nacrt",
  potvrđena: "Potvrđena",
  isporučena: "Isporučena",
  fakturisana: "Fakturisana",
  otkazana: "Otkazana",
};

// What happens to stock in each status.
export function holdsReservation(status: OrderStatus) {
  return status === "potvrđena";
}

export function hasLeftWarehouse(status: OrderStatus) {
  return status === "isporučena" || status === "fakturisana";
}
