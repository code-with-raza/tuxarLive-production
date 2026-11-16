import { secureServe } from "../_shared/http.ts";
const cors = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
const hex = (buffer: ArrayBuffer) =>
  [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
secureServe("cloudinary-sign-upload", { auth: "staff", roles: ["owner", "admin", "editor"], limit: 60 }, async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!,
      anon = Deno.env.get("SUPABASE_ANON_KEY")!,
      service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      auth = req.headers.get("Authorization") || "";
    const userRes = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: auth },
    });
    if (!userRes.ok) return reply({ error: "Authentication required" }, 401);
    const user = await userRes.json();
    const memberRes = await fetch(`${url}/rest/v1/admin_users?user_id=eq.${user.id}&select=role`, {
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    });
    const member = (await memberRes.json())?.[0];
    if (!member || !["owner", "admin", "editor"].includes(member.role))
      return reply({ error: "Media permission required" }, 403);
    const body = await req.json(),
      scope = body.scope === "email" ? "email" : "website",
      folder = String(body.folder || "general")
        .toLowerCase()
        .replace(/[^a-z0-9/_-]+/g, "-")
        .replace(/\.{2,}/g, "")
        .slice(0, 160),
      publicId = String(body.publicId || crypto.randomUUID())
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .slice(0, 120),
      timestamp = Math.floor(Date.now() / 1000),
      cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME")!,
      apiKey = Deno.env.get("CLOUDINARY_API_KEY")!,
      secret = Deno.env.get("CLOUDINARY_API_SECRET")!;
    if (!cloudName || !apiKey || !secret)
      return reply({ error: "Cloudinary is not configured" }, 503);
    const allowedFormats = "jpg,jpeg,png,webp,avif";
    const params = `allowed_formats=${allowedFormats}&folder=tuxar/${scope}/${folder}&overwrite=false&public_id=${publicId}&timestamp=${timestamp}`;
    const signature = hex(
      await crypto.subtle.digest("SHA-1", new TextEncoder().encode(params + secret)),
    );
    return reply({
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder: `tuxar/${scope}/${folder}`,
      publicId,
      allowedFormats,
    });
  } catch (e) {
    console.error(e);
    return reply({ error: "Unable to authorize upload" }, 400);
  }
});
