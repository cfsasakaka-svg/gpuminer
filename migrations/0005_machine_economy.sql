ALTER TABLE gpm_state ADD COLUMN welcome_claimed INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS gpm_machines (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL REFERENCES users(telegram_id), machine_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_gpm_machines_user ON gpm_machines(telegram_id);
