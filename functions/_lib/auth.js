const encoder = new TextEncoder();
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
export async function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData), receivedHash = params.get("hash"), authDate = Number(params.get("auth_date"));
  if (!receivedHash || !Number.isFinite(authDate)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > 86400) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const hmacKey = await crypto.subtle.importKey("raw", encoder.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secret = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(botToken));
  const signingKey = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", signingKey, encoder.encode(dataCheckString));
  const expected = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
  if (!safeEqual(receivedHash, expected)) return null;
  try {
    const u = JSON.parse(params.get("user") || "null");
    if (!u || !Number.isSafeInteger(Number(u.id))) return null;
    return { id: String(u.id), username: typeof u.username === "string" ? u.username.slice(0, 64) : null, firstName: typeof u.first_name === "string" ? u.first_name.slice(0, 128) : null };
  } catch { return null; }
}
export async function requireTelegram(request, env) {
  return verifyTelegramInitData(request.headers.get("X-Telegram-Init-Data") || "", env.TELEGRAM_BOT_TOKEN);
}
export function usdFromMicros(value) { return (Number(value || 0) / 1000000).toFixed(6); }
