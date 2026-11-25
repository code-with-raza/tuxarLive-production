export type UsdRate = { version: 1; rateE8: number; date: string; expiresAt: number };
export type UsdQuote = UsdRate & { token: string };

export function validUsdRate(value: unknown, now = Date.now()): value is UsdRate {
  const row = value as UsdRate | null;
  if (!row || row.version !== 1 || !Number.isSafeInteger(row.rateE8) || row.rateE8 < 1000000 || row.rateE8 > 10000000000 ||
      !Number.isSafeInteger(row.expiresAt) || row.expiresAt <= now || row.expiresAt > now + 2 * 3600000 + 60000 ||
      typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return false;
  const date = Date.parse(`${row.date}T00:00:00Z`);
  return Number.isFinite(date) && date <= now + 86400000 && date >= now - 7 * 86400000;
}

/** Round each unit to the nearest cent, then multiply quantities. Shared with the browser. */
export function usdMinor(gbpMinor: number, rateE8: number): number {
  if (!Number.isSafeInteger(gbpMinor) || gbpMinor < 0 || !Number.isSafeInteger(rateE8) || rateE8 <= 0) throw new Error("Invalid conversion amount");
  const result = Number((BigInt(gbpMinor) * BigInt(rateE8) + 50000000n) / 100000000n);
  if (!Number.isSafeInteger(result) || result > 2147483647) throw new Error("Conversion amount exceeds the limit");
  return result;
}
