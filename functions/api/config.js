import { json } from "../_lib/auth.js";
export async function onRequestGet({ env }) {
  return json({
    rewardedAdsConfigured: Boolean(env.MONETAG_SDK_SCRIPT_URL && env.MONETAG_SDK_ZONE_ID),
    sdkScriptUrl: env.MONETAG_SDK_SCRIPT_URL || null,
    sdkZoneId: env.MONETAG_SDK_ZONE_ID || null
  });
}
