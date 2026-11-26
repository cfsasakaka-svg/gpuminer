ALTER TABLE gpm_machines ADD COLUMN upgrade_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ad_sessions ADD COLUMN gpm_snapshot_milli INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS gpm_double_rewards (ymid TEXT PRIMARY KEY,telegram_id TEXT NOT NULL REFERENCES users(telegram_id),amount_milli INTEGER NOT NULL,created_at TEXT NOT NULL);
ALTER TABLE gpm_double_rewards ADD COLUMN credited INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gpm_double_rewards ADD COLUMN ledger_logged INTEGER NOT NULL DEFAULT 0;
