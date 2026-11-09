// Mirror of private.line_amounts / private.round_money in the database, used only to preview amounts in the
// UI before saving. The database is the source of truth for every stored amount.
//
// Rules (same as SQL): net = round(quantity × net unit price × (1 − discount %)), VAT = round(net × rate %),
// gross = net + VAT, rounding half away from zero to 2 decimals; document totals are sums of rounded lines.
// The math runs on integers (cents and basis points) with BigInt, so there are no floating-point errors.

export type LineInput = {
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  vatRate: number;
};

export type Amounts = {
  net: number;
  vat: number;
  gross: number;
};

const BASIS_POINTS = BigInt(10000);
const HUNDRED = BigInt(100);

// Values have at most 2 decimals (numeric(12,2) and numeric(5,2) in the database).
function toHundredths(value: number) {
  return BigInt(Math.round(value * 100));
}

// Integer division rounded half away from zero (PostgreSQL's numeric rounding).
function divideRounded(numerator: bigint, denominator: bigint) {
  const sign = numerator < BigInt(0) ? BigInt(-1) : BigInt(1);
  const absolute = numerator * sign;
  return sign * ((absolute * BigInt(2) + denominator) / (denominator * BigInt(2)));
}

function fromCents(cents: bigint) {
  return Number(cents) / 100;
}

export function lineAmounts({ quantity, unitPrice, discountPercent = 0, vatRate }: LineInput): Amounts {
  const priceCents = toHundredths(unitPrice);
  const keptBasisPoints = BASIS_POINTS - toHundredths(discountPercent);
  const netCents = divideRounded(BigInt(quantity) * priceCents * keptBasisPoints, BASIS_POINTS);
  const vatCents = divideRounded(netCents * toHundredths(vatRate), BASIS_POINTS);

  return { net: fromCents(netCents), vat: fromCents(vatCents), gross: fromCents(netCents + vatCents) };
}

export function documentTotals(lines: LineInput[]): Amounts {
  let net = BigInt(0);
  let vat = BigInt(0);
  for (const line of lines) {
    const amounts = lineAmounts(line);
    net += toHundredths(amounts.net);
    vat += toHundredths(amounts.vat);
  }
  return { net: fromCents(net), vat: fromCents(vat), gross: fromCents(net + vat) };
}

// Same rounding for a single amount, e.g. a payment typed by the user.
export function roundMoney(value: number) {
  return fromCents(divideRounded(BigInt(Math.round(value * 10000)), HUNDRED));
}
