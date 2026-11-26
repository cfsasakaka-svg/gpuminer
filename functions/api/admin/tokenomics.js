import { json, requireTelegram } from "../../_lib/auth.js";

// Esta vista informa la planificación; no crea ni emite tokens.
const INITIAL_RESERVE_GPM = 100_000_000;
const OWNER_ALLOCATION_BPS = 1000;

export async function onRequestGet({ request, env }) {
  if (!env.DB || !env.ADMIN_TELEGRAM_ID) return json({ error: "admin_not_configured" }, 503);
  const user = await requireTelegram(request, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.id !== String(env.ADMIN_TELEGRAM_ID)) return json({ error: "forbidden" }, 403);

  const users = await env.DB.prepare("SELECT COUNT(*) AS total FROM users").first();
  return json({
    initialReserveGPM: INITIAL_RESERVE_GPM,
    plannedOwnerAllocationPercent: OWNER_ALLOCATION_BPS / 100,
    users: Number(users?.total || 0),
    contractDeployed: false,
    onchainIssuedGPM: null,
    reserveStatus: "planned_not_issued",
    issuancePolicy: "La asignación adicional del 10% se calculará únicamente sobre emisiones reales verificadas en BNB Smart Chain.",
    notice: "La reserva de 100 millones es una asignación planificada. No son tokens emitidos ni un saldo transferible."
  });
}
