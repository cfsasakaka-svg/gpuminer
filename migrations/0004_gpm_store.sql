CREATE TABLE IF NOT EXISTS gpm_orders (
 id TEXT PRIMARY KEY, telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
 sku TEXT NOT NULL, amount_usd_cents INTEGER NOT NULL, gpm_milli INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_gpm_orders_user ON gpm_orders(telegram_id);
