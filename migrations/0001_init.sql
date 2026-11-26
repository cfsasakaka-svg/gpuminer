CREATE TABLE IF NOT EXISTS users (
  telegram_id TEXT PRIMARY KEY, username TEXT, first_name TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ad_sessions (
  ymid TEXT PRIMARY KEY, telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  request_var TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ad_sessions_expiry ON ad_sessions(expires_at);
CREATE TABLE IF NOT EXISTS ad_postbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ymid TEXT NOT NULL, event_type TEXT NOT NULL,
  reward_event_type TEXT NOT NULL, estimated_price TEXT NOT NULL, zone_id TEXT,
  sub_zone_id TEXT, received_at TEXT NOT NULL, UNIQUE(ymid, event_type)
);
CREATE TABLE IF NOT EXISTS monetized_events (
  ymid TEXT PRIMARY KEY, telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  estimated_usd_micros INTEGER NOT NULL, user_share_usd_micros INTEGER NOT NULL,
  owner_share_usd_micros INTEGER NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monetized_events_user ON monetized_events(telegram_id);
CREATE TABLE IF NOT EXISTS reward_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  ymid TEXT NOT NULL UNIQUE REFERENCES monetized_events(ymid),
  amount_usd_micros INTEGER NOT NULL CHECK(amount_usd_micros >= 0), created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_user ON reward_ledger(telegram_id);
