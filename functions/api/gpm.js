import { json, requireTelegram } from "../_lib/auth.js";
const RATE_MILLI_PER_MINUTE = 200; // 0.2 GPM/min; virtual points, not mining or cash.
const MAX_CREDIT_SECONDS = 300;
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "service_unavailable" }, 503);
  const user = await requireTelegram(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  const now = Math.floor(Date.now()/1000);
  await env.DB.prepare("INSERT INTO users (telegram_id, username, first_name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, updated_at=datetime('now')").bind(user.id,user.username,user.firstName).run();
  await env.DB.prepare("INSERT INTO gpm_state (telegram_id,balance_milli,last_tick_at,updated_at) VALUES (?,0,?,datetime('now')) ON CONFLICT(telegram_id) DO NOTHING").bind(user.id,now).run();
  const state=await env.DB.prepare("SELECT balance_milli,last_tick_at FROM gpm_state WHERE telegram_id=?").bind(user.id).first();
  const elapsed=Math.max(0,Math.min(now-Number(state.last_tick_at||now),MAX_CREDIT_SECONDS));
  const award=Math.floor(elapsed*RATE_MILLI_PER_MINUTE/60);
  if (award>0) {
    await env.DB.batch([
      env.DB.prepare("UPDATE gpm_state SET balance_milli=balance_milli+?,last_tick_at=?,updated_at=datetime('now') WHERE telegram_id=?").bind(award,now,user.id),
      env.DB.prepare("INSERT INTO gpm_ledger (telegram_id,amount_milli,reason,created_at) VALUES (?,?,'farm_activity',datetime('now'))").bind(user.id,award)
    ]);
  } else {
    await env.DB.prepare("UPDATE gpm_state SET last_tick_at=?,updated_at=datetime('now') WHERE telegram_id=?").bind(now,user.id).run();
  }
  const final=await env.DB.prepare("SELECT balance_milli,last_tick_at FROM gpm_state WHERE telegram_id=?").bind(user.id).first();
  const history=await env.DB.prepare("SELECT COALESCE(SUM(amount_milli),0) total_milli,COUNT(*) ticks FROM gpm_ledger WHERE telegram_id=?").bind(user.id).first();
  return json({gpm:Number(final?.balance_milli||0)/1000, gpmMilli:Number(final?.balance_milli||0), earnedMilli:Number(history?.total_milli||0), ticks:Number(history?.ticks||0), ratePerMinute:RATE_MILLI_PER_MINUTE/1000, nextTickSeconds:60, virtual:true});
}
