export type Currency = "GBP" | "EUR";
export function currencyForCountry(country: string): Currency {
  return ["Germany", "Spain", "France", "Italy"].includes(country) ? "EUR" : "GBP";
}
export function isCurrency(value: unknown): value is Currency { return value === "GBP" || value === "EUR"; }
export function paymentMatches(order: {currency: string; total_pence: number}, session: {currency: string; amount_total: number; payment_status: string}) {
  return isCurrency(order.currency) && session.currency === order.currency.toLowerCase() && session.amount_total === order.total_pence &&
    (session.payment_status === "paid" || (session.payment_status === "no_payment_required" && session.amount_total === 0));
}
