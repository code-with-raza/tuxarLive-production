import { secureServe } from "../_shared/http.ts";
// Keep older clients safe without publishing an account directory.
secureServe("registration-email-status", { auth: "public", limit: 10 }, () => Response.json({ error: "Please continue through registration or sign in" }, { status: 410 }));
