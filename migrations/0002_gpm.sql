CREATE TABLE IF NOT EXISTS gpm_state (
  telegram_id TEXT PRIMARY KEY REFERENCES users(telegram_id),
  balance_milli INTEGER NOT NULL DEFAULT 0 CHECK(balance_milli >= 0),
  last_tick_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gpm_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  amount_milli INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gpm_ledger_user ON gpm_ledger(telegram_id);
