export function savedCurrency(value?: string) { return value === "USD" ? "USD" : value === "EUR" ? "EUR" : "GBP"; }
export function formatOrderAmount(minor: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB",{style:"currency",currency:savedCurrency(currency)}).format(minor/100);
}
export function formatCataloguePrice(minor: number) { return `${formatOrderAmount(minor,"GBP")} / ${formatOrderAmount(minor,"EUR")}`; }
export function formatOrderTotals(orders: {total_pence:number;currency?:string}[]) {
  return (["GBP","EUR","USD"] as const).map(currency => {
    const rows = orders.filter(order => savedCurrency(order.currency) === currency);
    return rows.length ? formatOrderAmount(rows.reduce((sum,order)=>sum+order.total_pence,0),currency) : null;
  }).filter(Boolean).join(" + ") || formatOrderAmount(0);
}
