import { secureServe, HttpError } from "../_shared/http.ts";
import { signUsdQuote } from "../_shared/usd-quote.ts";
import { validUsdRate, type UsdRate } from "../_shared/usd-money.ts";

let cached: { rateE8: number; date: string; fetchedAt: number } | null = null;
let pending: Promise<void> | null = null;
async function updateRate() {
  const response = await fetch("https://api.frankfurter.dev/v2/rate/gbp/usd", { signal: AbortSignal.timeout(8000), redirect: "error" });
  if (!response.ok) throw new HttpError(503, "USD pricing is temporarily unavailable. Retry or choose GBP.");
  const data = await response.json();
  if (data.base !== "GBP" || data.quote !== "USD" || typeof data.rate !== "number") throw new HttpError(503, "USD rate provider returned an invalid rate");
  const rate: UsdRate = { version: 1, rateE8: Math.round(data.rate * 100000000), date: data.date, expiresAt: Date.now() + 2 * 3600000 };
  if (!validUsdRate(rate)) throw new HttpError(503, "A current USD exchange rate is unavailable");
  cached = { rateE8: rate.rateE8, date: rate.date, fetchedAt: Date.now() };
}
secureServe("usd-rate", { auth: "public", limit: 30, windowSeconds: 60 }, async () => {
  if (!cached || Date.now() - cached.fetchedAt > 3600000) {
    pending ??= updateRate().finally(() => { pending = null; });
    await pending;
  }
  if (!cached) throw new HttpError(503, "USD pricing is unavailable");
  const quote = await signUsdQuote({ version: 1, rateE8: cached.rateE8, date: cached.date, expiresAt: Date.now() + 2 * 3600000 }, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  return Response.json(quote);
});
