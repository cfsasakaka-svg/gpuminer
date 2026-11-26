import { json, requireTelegram, usdFromMicros } from "../../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  if (!env.DB || !env.ADMIN_TELEGRAM_ID) return json({ error: "admin_not_configured" }, 503);
  const user = await requireTelegram(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.id !== String(env.ADMIN_TELEGRAM_ID)) return json({ error: "forbidden" }, 403);
  const split = await env.DB.prepare("SELECT COALESCE(SUM(estimated_usd_micros),0) AS revenue, COALESCE(SUM(user_share_usd_micros),0) AS users, COALESCE(SUM(owner_share_usd_micros),0) AS owner, COUNT(*) AS valued_events FROM monetized_events").first();
  const ownerOnly = await env.DB.prepare("SELECT COALESCE(SUM(estimated_usd_micros),0) AS revenue, COUNT(*) AS valued_events FROM owner_ad_events").first();
  const users = await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
  const splitRevenue = Number(split?.revenue || 0), ownerOnlyRevenue = Number(ownerOnly?.revenue || 0);
  return json({
    users: Number(users?.total || 0),
    valuedEvents: Number(split?.valued_events || 0) + Number(ownerOnly?.valued_events || 0),
    estimatedRevenue: usdFromMicros(splitRevenue + ownerOnlyRevenue),
    userShare: usdFromMicros(split?.users || 0),
    ownerShare: usdFromMicros(Number(split?.owner || 0) + ownerOnlyRevenue),
    splitRevenue: usdFromMicros(splitRevenue),
    ownerOnlyRevenue: usdFromMicros(ownerOnlyRevenue)
  });
}
