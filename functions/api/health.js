import { json } from "../_lib/auth.js";
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ status: "degraded", database: false }, 503);
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ status: "ok", database: true });
  } catch {
    return json({ status: "degraded", database: false }, 503);
  }
}
