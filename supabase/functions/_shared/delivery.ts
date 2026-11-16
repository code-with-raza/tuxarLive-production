export const MIN_DELIVERY_WORKING_DAYS = 7;
export const MAX_DELIVERY_WORKING_DAYS = 10;
export const DELIVERY_ESTIMATE_EN = "Estimated delivery: 7–10 working days.";

export const DELIVERY_OPTIONS = [
  { id: "UPS", name: "UPS", minDays: 7, maxDays: 14, pricePence: 0 },
  { id: "DHL", name: "DHL", minDays: 7, maxDays: 14, pricePence: 0 },
  { id: "DPD", name: "DPD Geopost", minDays: 7, maxDays: 10, pricePence: 0 },
] as const;
export const DELIVERY_COUNTRIES = [
  { code: "GB", name: "United Kingdom" }, { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" }, { code: "FR", name: "France" }, { code: "IT", name: "Italy" },
] as const;
export function getDeliveryCountry(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return DELIVERY_COUNTRIES.find(country => country.name.toLowerCase() === normalized || country.code.toLowerCase() === normalized || (country.code === "GB" && normalized === "uk"));
}
export function getDeliveryOption(id: unknown) {
  return DELIVERY_OPTIONS.find(option => option.id === id);
}
export function orderDeliveryEstimate(courier: unknown) {
  const option = DELIVERY_OPTIONS.find(item => item.id === courier || item.name === courier);
  return option ? `${option.name}: ${option.minDays}–${option.maxDays} working days.` : DELIVERY_ESTIMATE_EN;
}

/** Count Monday–Friday after the order date; never use calendar-day offsets. */
export function addWorkingDays(start: Date, days: number): string {
  if (!Number.isFinite(start.getTime()) || !Number.isInteger(days) || days < 0) throw new Error("Invalid delivery date");
  const date = new Date(start.getTime());
  for (let count = 0; count < days;) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) count += 1;
  }
  return date.toISOString().slice(0, 10);
}

export function estimatedDeliveryWindow(start = new Date(), maxDays: number = MAX_DELIVERY_WORKING_DAYS) {
  return {
    from: addWorkingDays(start, MIN_DELIVERY_WORKING_DAYS),
    to: addWorkingDays(start, maxDays),
  };
}
