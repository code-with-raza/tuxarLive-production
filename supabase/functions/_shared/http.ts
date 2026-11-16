import { getDeliveryCountry } from "./delivery.ts";

type Options = { auth: "public" | "user" | "staff"; roles?: string[]; limit?: number; windowSeconds?: number; emailLimit?: number };
type AuthUser = { id: string; email?: string };
type Handler = (request: Request, context: { user: AuthUser | null }) => Response | Promise<Response>;

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function trustedOrigins(): Set<string> {
  const origins = new Set(["https://tuxar.co.uk", "https://www.tuxar.co.uk"]);
  const configured = [Deno.env.get("SITE_URL"), ...(Deno.env.get("ADDITIONAL_ALLOWED_ORIGINS") || "").split(",")];
  for (const candidate of configured) {
    if (!candidate?.trim()) continue;
    const url = new URL(candidate.trim());
    if (url.protocol !== "https:") throw new HttpError(503, "Invalid server origin configuration");
    origins.add(url.origin);
  }
  if (Deno.env.get("ALLOW_LOCAL_ORIGINS") === "true") {
    origins.add("http://localhost:5173"); origins.add("http://localhost:4173");
  }
  return origins;
}

export async function readLimitedText(request: Request, maximum = 65536): Promise<string> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(declared) || declared > maximum) throw new HttpError(413, "Request is too large");
  if (!request.body) throw new HttpError(400, "Request body is required");
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > maximum) { await reader.cancel(); throw new HttpError(413, "Request is too large"); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function validateJson(value: unknown, depth = 0): void {
  if (depth > 8) throw new HttpError(400, "Request nesting exceeds the limit");
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new HttpError(400, "Invalid request property");
      validateJson(child, depth + 1);
    }
  }
}

export function validateCheckout(payload: Record<string, unknown>): void {
  const items = payload.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) throw new HttpError(400, "Invalid cart");
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== "object" || typeof item.slug !== "string" || !/^[a-z0-9-]{1,120}$/.test(item.slug) ||
      !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 10 ||
      typeof item.size !== "string" || !item.size.trim() || item.size.length > 30 ||
      typeof item.color !== "string" || !item.color.trim() || item.color.length > 50) throw new HttpError(400, "Invalid product option or quantity");
    const key = JSON.stringify([item.slug, item.size, item.color]);
    if (seen.has(key)) throw new HttpError(400, "Combine duplicate product options into one cart item");
    seen.add(key);
  }
  const customer = payload.customer as Record<string, unknown> | null;
  if (!customer || typeof customer !== "object") throw new HttpError(400, "Shipping details are required");
  const fields: Record<string, number> = { customerName: 100, customerPhone: 40, streetAddress: 200, city: 100, postalCode: 20, country: 100 };
  for (const [name, max] of Object.entries(fields)) {
    const value = customer[name];
    if (typeof value !== "string" || !value.trim() || value.length > max || Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new HttpError(400, "Please check your shipping details");
  }
  if (!getDeliveryCountry(customer.country)) throw new HttpError(400, "Delivery is available to the United Kingdom, Germany, Spain, France and Italy");
}

async function rateLimit(name: string, subject: string, limit: number, seconds: number): Promise<void> {
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("RATE_LIMIT_SECRET") || Deno.env.get("OTP_PEPPER") || service;
  if (!url || !service || !secret) throw new HttpError(503, "Request protection is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const hash = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${name}:${subject}`));
  const bucket = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const response = await fetch(`${url}/rest/v1/rpc/consume_security_rate_limit`, {
    method: "POST", headers: { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
    body: JSON.stringify({ bucket_key: bucket, maximum_requests: limit, window_seconds: seconds }), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new HttpError(503, "Request protection is temporarily unavailable");
  if (await response.json() !== true) throw new HttpError(429, "Too many requests. Please try again later");
}

async function authenticate(request: Request, options: Options): Promise<AuthUser | null> {
  if (options.auth === "public") return null;
  const token = request.headers.get("Authorization") || "";
  if (!/^Bearer [^\s]+$/.test(token)) throw new HttpError(401, "Sign in to continue");
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) throw new HttpError(503, "Authentication is not configured");
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: service, Authorization: token }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new HttpError(401, "Sign in to continue");
  const user = await response.json() as AuthUser;
  if (!/^[0-9a-f-]{36}$/i.test(user.id)) throw new HttpError(401, "Invalid account");
  const headers = { apikey: service, Authorization: `Bearer ${service}` };
  const profile = await fetch(`${url}/rest/v1/customer_profiles?user_id=eq.${user.id}&select=account_status`, { headers, signal: AbortSignal.timeout(8000) });
  if (!profile.ok) throw new HttpError(503, "Account access could not be checked");
  if ((await profile.json())?.[0]?.account_status === "disabled") throw new HttpError(403, "Account access is disabled");
  if (options.auth === "staff") {
    const membership = await fetch(`${url}/rest/v1/admin_users?user_id=eq.${user.id}&select=role`, { headers });
    if (!membership.ok) throw new HttpError(503, "Staff access could not be checked");
    const member = (await membership.json())?.[0];
    if (!member || !(options.roles ?? ["owner", "admin"]).includes(member.role)) throw new HttpError(403, "Staff permission required");
    // The bearer token has already been verified by Supabase Auth above.
    const claims = JSON.parse(atob(token.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (claims.aal !== "aal2") throw new HttpError(403, "Complete staff two-factor authentication");
  }
  return user;
}

/** Independently export the handler so denial paths can be tested without a running server. */
export function createSecureHandler(name: string, options: Options, handler: Handler): (request: Request) => Promise<Response> {
  return async (request) => {
    const origin = request.headers.get("Origin");
    const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", Vary: "Origin" });
    try {
      if (origin) {
        if (!trustedOrigins().has(origin)) throw new HttpError(403, "Origin not allowed");
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
        headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      }
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
      if (request.method !== "POST") { headers.set("Allow", "POST, OPTIONS"); throw new HttpError(405, "Method not allowed"); }
      if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new HttpError(415, "Send JSON content");
      if (Deno.env.get("CHECKOUT_MAINTENANCE") === "true" && ["create-checkout-session", "create-cod-order"].includes(name)) throw new HttpError(503, "Checkout is temporarily unavailable for maintenance. Please try again shortly");
      const rawBody = await readLimitedText(request);
      let payload;
      try { payload = JSON.parse(rawBody); } catch { throw new HttpError(400, "Invalid JSON"); }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new HttpError(400, "Invalid request body");
      validateJson(payload);
      const seconds = options.windowSeconds ?? 60;
      // Deployment's trusted gateway must overwrite/append this header; the final hop is used.
      const ip = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
      await rateLimit(name, `ip:${ip}`, options.limit ?? 30, seconds);
      const user = await authenticate(request, options);
      if (user) await rateLimit(name, `user:${user.id}`, options.limit ?? 30, seconds);
      if (options.emailLimit) {
        if (typeof payload.email !== "string") throw new HttpError(400, "Enter a valid email address");
        if (payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())) throw new HttpError(400, "Enter a valid email address");
        await rateLimit(name, `email:${payload.email.trim().toLowerCase()}`, options.emailLimit, seconds);
      }
      if (name === "create-checkout-session" || name === "create-cod-order") validateCheckout(payload);
      const response = await handler(new Request(request.url, { method: "POST", headers: request.headers, body: rawBody, signal: request.signal }), { user });
      const finalHeaders = new Headers(response.headers);
      finalHeaders.delete("Access-Control-Allow-Origin");
      headers.forEach((value, key) => finalHeaders.set(key, value));
      return new Response(response.body, { status: response.status, headers: finalHeaders });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 503;
      if (status === 429) headers.set("Retry-After", String(options.windowSeconds ?? 60));
      return new Response(JSON.stringify({ error: error instanceof HttpError ? error.message : "Service temporarily unavailable" }), { status, headers });
    }
  };
}

export function secureServe(name: string, options: Options, handler: Handler): void {
  Deno.serve(createSecureHandler(name, options, handler));
}
