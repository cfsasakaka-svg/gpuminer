ALTER TABLE users ADD COLUMN invite_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code) WHERE invite_code IS NOT NULL;
CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  referred_telegram_id TEXT NOT NULL UNIQUE REFERENCES users(telegram_id),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_telegram_id);