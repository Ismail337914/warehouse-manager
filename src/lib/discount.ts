import type { AppRole } from "@/lib/permissions";

type DiscountLimits = { max_discount_prodavac: number; max_discount_menadzer: number };

// Same limits as private.max_discount_for_current_user in the database, which enforces them. The UI shows
// the limit as a hint and caps the input; admins have no limit.
export function maxDiscount(role: AppRole, settings: DiscountLimits | undefined) {
  if (role === "admin") return 100;
  if (!settings) return 0;
  return role === "menadzer" ? settings.max_discount_menadzer : settings.max_discount_prodavac;
}
