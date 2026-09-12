/** Shared money formatter. Defaults to whole-unit rounding (the KPI-card
 *  convention used across the dashboards); pass fractionDigits for amounts
 *  where cents matter, like an individual order or invoice line. */
export function formatCurrency(
  amount: number,
  currency: string,
  fractionDigits = 0,
): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
