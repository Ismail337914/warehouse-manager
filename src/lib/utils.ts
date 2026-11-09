import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Chrome lacks full "bs-BA" number data and prints 24,890 where Node prints 24.890, which breaks hydration.
// "hr-HR" uses the same format (24.890,50) and is available everywhere.
export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return value.toLocaleString("hr-HR", options);
}

// Local calendar date (YYYY-MM-DD). toISOString() would give yesterday's date shortly after midnight in Bosnia.
export function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Amounts with exactly 2 decimals: 3.202,29 KM.
export function formatMoney(value: number) {
  return `${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`;
}

const dateFormat = new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeZone: "Europe/Sarajevo" });
const dateTimeFormat = new Intl.DateTimeFormat("hr-HR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Sarajevo",
});

export function formatDate(value: string) {
  return dateFormat.format(new Date(value));
}

export function formatDateTime(value: string) {
  return dateTimeFormat.format(new Date(value));
}
