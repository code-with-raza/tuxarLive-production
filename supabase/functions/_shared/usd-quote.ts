import { HttpError } from "./http.ts";
import { validUsdRate, type UsdQuote, type UsdRate } from "./usd-money.ts";

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
async function key(secret: string) {
  if (!secret) throw new HttpError(503, "USD pricing is not configured");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
const message = (body: string) => new TextEncoder().encode(`tuxar-usd-quote-v1:${body}`);

export async function signUsdQuote(rate: UsdRate, secret: string): Promise<UsdQuote> {
  if (!validUsdRate(rate)) throw new HttpError(503, "A current USD exchange rate is unavailable");
  const body = encode(new TextEncoder().encode(JSON.stringify(rate)));
  const signature = await crypto.subtle.sign("HMAC", await key(secret), message(body));
  return { ...rate, token: `${body}.${encode(new Uint8Array(signature))}` };
}
export async function verifyUsdQuote(token: unknown, secret: string, now = Date.now()): Promise<UsdRate> {
  try {
    if (typeof token !== "string" || token.length > 2048 || !/^[\w-]+\.[\w-]+$/.test(token)) throw new Error();
    const [body, signature] = token.split(".");
    if (!await crypto.subtle.verify("HMAC", await key(secret), decode(signature), message(body))) throw new Error();
    const rate: unknown = JSON.parse(new TextDecoder().decode(decode(body)));
    if (!validUsdRate(rate, now)) throw new Error();
    return rate;
  } catch { throw new HttpError(409, "USD exchange rate expired or changed. Refresh USD pricing and review your total before paying."); }
}
