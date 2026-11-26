#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?Missing CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?Missing CLOUDFLARE_ACCOUNT_ID}"
: "${TELEGRAM_BOT_TOKEN:?Missing TELEGRAM_BOT_TOKEN}"
: "${MONETAG_POSTBACK_SECRET:?Missing MONETAG_POSTBACK_SECRET}"

wrangler pages project create gpuminer --production-branch main >/dev/null 2>&1 || true

api="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database"
db_id=$(curl -fsS -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" "$api" | jq -r '.result[]? | select(.name=="gpuminer-db") | .uuid' | head -n1)
if [ -z "$db_id" ]; then
  wrangler d1 create gpuminer-db
  db_id=$(curl -fsS -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" "$api" | jq -r '.result[]? | select(.name=="gpuminer-db") | .uuid' | head -n1)
fi
if [ -z "$db_id" ] || [ "$db_id" = "null" ]; then
  echo "Could not resolve the D1 database ID." >&2
  exit 1
fi

cat > wrangler.toml <<EOF
name = "gpuminer"
compatibility_date = "2026-11-26"
pages_build_output_dir = "."

[[d1_databases]]
binding = "DB"
database_name = "gpuminer-db"
database_id = "$db_id"
migrations_dir = "migrations"
EOF

wrangler d1 migrations apply gpuminer-db --remote --config wrangler.toml
printf '%s' "$TELEGRAM_BOT_TOKEN" | wrangler pages secret put TELEGRAM_BOT_TOKEN --project-name gpuminer
printf '%s' "$MONETAG_POSTBACK_SECRET" | wrangler pages secret put MONETAG_POSTBACK_SECRET --project-name gpuminer
if [ -n "${ADMIN_TELEGRAM_ID:-}" ]; then
  printf '%s' "$ADMIN_TELEGRAM_ID" | wrangler pages secret put ADMIN_TELEGRAM_ID --project-name gpuminer
fi
if [ -n "${MONETAG_SDK_SCRIPT_URL:-}" ]; then
  printf '%s' "$MONETAG_SDK_SCRIPT_URL" | wrangler pages secret put MONETAG_SDK_SCRIPT_URL --project-name gpuminer
fi
if [ -n "${MONETAG_SDK_ZONE_ID:-}" ]; then
  printf '%s' "$MONETAG_SDK_ZONE_ID" | wrangler pages secret put MONETAG_SDK_ZONE_ID --project-name gpuminer
fi
wrangler pages deploy . --project-name=gpuminer --branch=main
