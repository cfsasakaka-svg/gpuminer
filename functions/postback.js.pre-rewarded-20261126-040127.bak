function sameSecret(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export async function onRequestGet({ request, env }) {
  if (!env.DB || !env.MONETAG_POSTBACK_SECRET) return new Response("Unavailable", { status: 503 });
  const p = new URL(request.url).searchParams;
  if (!sameSecret(p.get("secret") || "", env.MONETAG_POSTBACK_SECRET)) return new Response("Forbidden", { status: 403 });
  const ymid = p.get("ymid") || "", eventType = p.get("event_type") || "", rewardType = p.get("reward_event_type") || "";
  const priceText = p.get("estimated_price") || "0", price = Number(priceText);
  if (!/^[0-9a-f-]{36}$/i.test(ymid) || !["impression", "click"].includes(eventType) || !["valued", "non_valued"].includes(rewardType) || !Number.isFinite(price) || price < 0 || price > 1000) return new Response("Bad request", { status: 400 });
  const session = await env.DB.prepare("SELECT telegram_id FROM ad_sessions WHERE ymid=? AND expires_at >= datetime('now')").bind(ymid).first();
  if (!session) return new Response("Unknown or expired ad session", { status: 404 });
  const micros = Math.round(price * 1000000), userShare = Math.floor(micros * 0.30), ownerShare = micros - userShare;
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO ad_postbacks (ymid, event_type, reward_event_type, estimated_price, zone_id, sub_zone_id, received_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").bind(ymid, eventType, rewardType, priceText, p.get("zone_id"), p.get("sub_zone_id")),
    env.DB.prepare("INSERT OR IGNORE INTO monetized_events (ymid, telegram_id, estimated_usd_micros, user_share_usd_micros, owner_share_usd_micros, created_at) SELECT ?, ?, ?, ?, ?, datetime('now') WHERE ?='impression' AND ?='valued' AND ? > 0").bind(ymid, session.telegram_id, micros, userShare, ownerShare, eventType, rewardType, micros),
    env.DB.prepare("INSERT OR IGNORE INTO reward_ledger (telegram_id, ymid, amount_usd_micros, created_at) SELECT telegram_id, ymid, user_share_usd_micros, datetime('now') FROM monetized_events WHERE ymid=? AND user_share_usd_micros > 0").bind(ymid)
  ]);
  return new Response("OK", { status: 200, headers: { "cache-control": "no-store" } });
}
