import { json, requireTelegram, usdFromMicros } from "../_lib/auth.js";
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "service_unavailable" }, 503);
  const user = await requireTelegram(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  await env.DB.prepare("INSERT INTO users (telegram_id, username, first_name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, updated_at=datetime('now')").bind(user.id, user.username, user.firstName).run();
  const row = await env.DB.prepare("SELECT COALESCE(SUM(amount_usd_micros),0) AS balance_micros, COUNT(*) AS rewards FROM reward_ledger WHERE telegram_id=?").bind(user.id).first();
  const xp = Number(row?.rewards || 0) * 20;
  return json({ user: { id: user.id, username: user.username, firstName: user.firstName }, balance: usdFromMicros(row?.balance_micros), rewards: Number(row?.rewards || 0), xp, rank: Math.floor(xp / 100) + 1 });
}
