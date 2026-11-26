import { json, requireTelegram } from "../_lib/auth.js";

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return [...bytes].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function ensureUser(env, user) {
  await env.DB.prepare(
    "INSERT INTO users (telegram_id, username, first_name, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now')) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, updated_at=datetime('now')"
  ).bind(user.id, user.username, user.firstName).run();
  let row = await env.DB.prepare("SELECT invite_code FROM users WHERE telegram_id=?").bind(user.id).first();
  if (!row?.invite_code) {
    await env.DB.prepare("UPDATE users SET invite_code=? WHERE telegram_id=? AND invite_code IS NULL").bind(makeCode(), user.id).run();
    row = await env.DB.prepare("SELECT invite_code FROM users WHERE telegram_id=?").bind(user.id).first();
  }
  return row?.invite_code || null;
}

async function attributeReferral(env, user, code) {
  if (!code || !/^ref_[A-F0-9]{18}$/i.test(code)) return false;
  const already = await env.DB.prepare("SELECT 1 AS found FROM referrals WHERE referred_telegram_id=?").bind(user.id).first();
  if (already) return false;
  const referrer = await env.DB.prepare("SELECT telegram_id FROM users WHERE invite_code=?").bind(code.slice(4).toUpperCase()).first();
  if (!referrer || String(referrer.telegram_id) === String(user.id)) return false;
  const result = await env.DB.prepare(
    "INSERT OR IGNORE INTO referrals (referrer_telegram_id, referred_telegram_id, created_at) VALUES (?, ?, datetime('now'))"
  ).bind(referrer.telegram_id, user.id).run();
  if (Number(result?.meta?.changes || 0) <= 0) return false;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO gpm_state (telegram_id,balance_milli,last_tick_at,updated_at,welcome_claimed) VALUES (?,500000,unixepoch(),datetime('now'),1) ON CONFLICT(telegram_id) DO NOTHING").bind(user.id),
    env.DB.prepare("INSERT INTO gpm_ledger (telegram_id,amount_milli,reason,created_at) SELECT ?,500000,'welcome_bonus',datetime('now') WHERE changes()>0").bind(user.id)
  ]);
  return true;
}

async function getStats(env, user, inviteCode) {
  const stats = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM referrals WHERE referrer_telegram_id=?"
  ).bind(user.id).first();
  return {
    inviteCode,
    inviteLink: "https://t.me/GPU_MINERBOT?startapp=ref_" + inviteCode,
    referrals: Number(stats?.total || 0),
    attribution: "Las invitaciones se cuentan cuando la persona abre la Mini App por primera vez desde tu enlace.",
    rewardsEnabled: false,
    referralWelcomeBonusGPM: 500
  };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "service_unavailable" }, 503);
  const user = await requireTelegram(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  const inviteCode = await ensureUser(env, user);
  return json(await getStats(env, user, inviteCode));
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "service_unavailable" }, 503);
  const user = await requireTelegram(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  const existing = await env.DB.prepare("SELECT 1 AS found FROM users WHERE telegram_id=?").bind(user.id).first();
  const inviteCode = await ensureUser(env, user);
  let attributed = false;
  if (!existing && user.startParam) attributed = await attributeReferral(env, user, user.startParam);
  return json({ ...(await getStats(env, user, inviteCode)), attributed });
}
