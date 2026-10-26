/**
 * USDC on Stellar, like every classic asset, has 7 decimals. Contracts count in
 * those base units; people read whole dollars. These helpers are the only place
 * the two meet, and they stay in `bigint` so no amount ever passes through a
 * float on its way to the ledger.
 */
export const USDC_DECIMALS = 7;

const SCALE = 10n ** BigInt(USDC_DECIMALS);

/** Whole USDC (number or decimal string) to base units. Extra decimals are cut. */
export function toUnits(value: number | string): bigint {
  const text = typeof value === "number" ? value.toFixed(USDC_DECIMALS) : value;
  const trimmed = text.trim().replace(/,/g, "");
  if (!/^-?\d*(\.\d*)?$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    throw new Error(`Not an amount: ${value}`);
  }
  const negative = trimmed.startsWith("-");
  const [whole = "0", fraction = ""] = trimmed.replace("-", "").split(".");
  const units =
    BigInt(whole || "0") * SCALE +
    BigInt(fraction.slice(0, USDC_DECIMALS).padEnd(USDC_DECIMALS, "0"));
  return negative ? -units : units;
}

/** Base units to whole USDC, as a number for display and arithmetic in the UI. */
export function fromUnits(units: bigint | number | string): number {
  const value = BigInt(units);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / SCALE;
  const fraction = abs % SCALE;
  const result = Number(whole) + Number(fraction) / Number(SCALE);
  return negative ? -result : result;
}

/** Base units formatted as dollars, e.g. `$113,000.00`. */
export function formatUsdc(
  units: bigint | number | string,
  options: Intl.NumberFormatOptions = {}
): string {
  return fromUnits(units).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
}
