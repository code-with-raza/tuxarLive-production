export const PUBLIC_ENV_NAMES = new Set([
  "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY",
  "VITE_GA_MEASUREMENT_ID", "VITE_STRIPE_ENABLED",
]);

export function assertPublicEnvironment(environment) {
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith("VITE_")) continue;
    if (!PUBLIC_ENV_NAMES.has(name)) throw new Error(`Unapproved browser environment variable: ${name}. Keep secrets in server configuration.`);
    if (!value) continue;
    for (const token of value.matchAll(/\b[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
      let privateRole = false;
      try { privateRole = JSON.parse(Buffer.from(token[1], "base64url").toString()).role === "service_role"; } catch { /* Not a decodable JWT. */ }
      if (privateRole) throw new Error(`A service-role credential was assigned to ${name}. Its value was not logged.`);
    }
    if (/\b(?:sk|rk)_(?:live|test)_|sb_secret_|-----BEGIN .*PRIVATE KEY-----/.test(value)) {
      throw new Error(`A private credential was assigned to ${name}. Its value was not logged.`);
    }
    if (name === "VITE_SUPABASE_URL") {
      let url;
      try { url = new URL(value); } catch { throw new Error("VITE_SUPABASE_URL must be a valid HTTP(S) URL"); }
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("VITE_SUPABASE_URL must not contain embedded credentials");
    }
    if (/SUPABASE_(?:PUBLISHABLE|ANON)_KEY$/.test(name)) {
      if (value.startsWith("sb_publishable_")) continue;
      try {
        const claim = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString());
        if (claim.role === "anon") continue;
      } catch { /* Fail closed for unknown credential formats. */ }
      throw new Error(`${name} must be a Supabase publishable key or a legacy anon key. Values are never logged.`);
    }
  }
}
