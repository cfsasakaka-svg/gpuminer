import { json, requireTelegram } from "../_lib/auth.js";
const ALLOWED = new Set(["daily_mission", "gpu_upgrade", "farm_visit", "session_bonus", "double_gpm"]);
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "service_unavailable" }, 503);
  const user = await requireTelegram(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  let body; try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const placement = String(body?.requestVar || "");
  if (!ALLOWED.has(placement)) return json({ error: "invalid_placement" }, 400);
  const ymid = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO users (telegram_id, username, first_name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, updated_at=datetime('now')").bind(user.id, user.username, user.firstName).run();
  let snap=0;if(placement==='double_gpm'){const g=await env.DB.prepare("SELECT balance_milli FROM gpm_state WHERE telegram_id=?").bind(user.id).first();snap=Number(g?.balance_milli||0);if(snap<=0)return json({error:"empty_gpm"},400);}await env.DB.prepare("INSERT INTO ad_sessions (ymid, telegram_id, request_var, created_at, expires_at,gpm_snapshot_milli) VALUES (?, ?, ?, datetime('now'), datetime('now', '+48 hours'),?)").bind(ymid, user.id, placement,snap).run();
  return json({ ymid, expiresInSeconds: 172800 });
}
