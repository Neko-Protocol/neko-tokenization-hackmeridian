import { toUnits } from "./amounts";
import { BPS_DENOMINATOR, expectedRepayment } from "./deployments";

/**
 * How an application's commercial terms become a vault's constructor
 * arguments. The backend applies the same formulas when it launches a vault,
 * so what the issuer and the reviewer see here is what goes on the ledger.
 */

/**
 * The total rate over the life of the loan, in basis points: the annual yield
 * prorated by the term, as simple interest. The vault never computes interest;
 * it only compares repayments against the total this produces.
 */
export function repaymentRateBps(yieldPct: number, termMonths: number): number {
  return Math.round((yieldPct * 100 * termMonths) / 12);
}

/** Principal plus interest, in base units, for a raise of `target` whole USDC. */
export function totalRepayment(
  target: number,
  yieldPct: number,
  termMonths: number
): bigint {
  return expectedRepayment(
    toUnits(target),
    repaymentRateBps(yieldPct, termMonths)
  );
}

/**
 * Split the total repayment into tranches by percentage. Each share is rounded
 * down and the last tranche takes the remainder, so the tranches always add up
 * to exactly the total and the vault can settle on the final payment.
 */
export function splitTranches(total: bigint, percentages: number[]): bigint[] {
  if (percentages.length === 0) {
    return [];
  }
  const amounts = percentages.map(
    (pct) => (total * BigInt(Math.round(pct * 100))) / BigInt(BPS_DENOMINATOR)
  );
  const allButLast = amounts
    .slice(0, -1)
    .reduce((sum, amount) => sum + amount, 0n);
  amounts[amounts.length - 1] = total - allButLast;
  return amounts;
}

/** The ticker the token is minted under: 2 to 12 capitals or digits. */
export const TOKEN_SYMBOL_PATTERN = /^[A-Z0-9]{2,12}$/;

export function isValidTokenSymbol(symbol: string): boolean {
  return TOKEN_SYMBOL_PATTERN.test(symbol);
}

/** A starting ticker from the asset's name, e.g. "Casa Heredia" to "CASAHE". */
export function suggestTokenSymbol(assetName: string): string {
  const letters = assetName
    .normalize("NFD")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  if (letters.length === 0) {
    return "NEKO";
  }
  const symbol =
    letters.length === 1
      ? letters[0].slice(0, 6)
      : letters
          .map((word) => word.slice(0, 4))
          .join("")
          .slice(0, 8);
  return symbol.length >= 2 ? symbol : `${symbol}X`;
}
