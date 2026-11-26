# GPUMINER backend foundation

Cloudflare Pages Functions provide the API. D1 stores Telegram users, ad sessions, Monetag postbacks, and the reward ledger.

## Server-side bindings and secrets

- `DB`: Cloudflare D1 database.
- `TELEGRAM_BOT_TOKEN`: existing Telegram bot token; used only to validate Telegram Mini App initData.
- `MONETAG_POSTBACK_SECRET`: private secret in the Monetag postback URL.
- `ADMIN_TELEGRAM_ID`: optional owner Telegram numeric ID for the private summary endpoint.
- `MONETAG_SDK_SCRIPT_URL` and `MONETAG_SDK_ZONE_ID`: exact values copied from the Monetag Telegram Mini App SDK dashboard. Do not reuse website tag IDs unless Monetag explicitly identifies them as the TMA SDK zone.

## API

- `GET /api/health`: backend/database health.
- `GET /api/config`: public ad-SDK readiness only.
- `GET /api/me`: authenticated Telegram account, verified reward balance and XP.
- `POST /api/ad-session`: creates a unique ymid linked to the authenticated Telegram user.
- `GET /postback`: Monetag server-to-server confirmation endpoint.
- `GET /api/admin/summary`: private owner summary, requires `ADMIN_TELEGRAM_ID`.

The postback accepts only server-confirmed `valued` impressions. A unique ymid prevents duplicate credits. The estimated revenue is split 30% to the user ledger and 70% to the owner ledger. XP is derived from verified reward-ledger entries (20 XP per credited event), not from a browser-side claim.

## Monetag setup still required

1. Add GPUMINER as a Telegram Mini App in Monetag.
2. Generate the TMA SDK tag for Rewarded Interstitial.
3. Save its exact script URL and main SDK zone ID as GitHub Actions secrets `MONETAG_SDK_SCRIPT_URL` and `MONETAG_SDK_ZONE_ID`.
4. In that SDK zone's Postback URL field, configure:
   `https://gpuminer.pages.dev/postback?secret=YOUR_MONETAG_POSTBACK_SECRET&ymid={ymid}&zone_id={zone_id}&sub_zone_id={sub_zone_id}&event_type={event_type}&reward_event_type={reward_event_type}&estimated_price={estimated_price}`
5. The postback secret is stored as the GitHub Actions secret `MONETAG_POSTBACK_SECRET` and is deployed server-side. Do not put it in HTML or Telegram messages.
6. Set `ADMIN_TELEGRAM_ID` to the owner's numeric Telegram user ID to enable the private admin summary.

No withdrawals are enabled by this foundation. A payment provider, withdrawal review rules, and compliance checks must be configured before real payouts can be offered.
