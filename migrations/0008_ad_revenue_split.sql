-- Rewarded impressions outside the dedicated income-generation placement
-- belong entirely to the owner and must never enter the 70/30 user ledger.
CREATE TABLE IF NOT EXISTS owner_ad_events (
  ymid TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL REFERENCES users(telegram_id),
  estimated_usd_micros INTEGER NOT NULL CHECK(estimated_usd_micros >= 0),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_owner_ad_events_user ON owner_ad_events(telegram_id);

-- Reclassify any previously split ad sessions that were not the income-generation
-- placement. Their full estimated value belongs to the owner; remove their user ledger.
INSERT OR IGNORE INTO owner_ad_events (ymid, telegram_id, estimated_usd_micros, created_at)
SELECT m.ymid, m.telegram_id, m.estimated_usd_micros, m.created_at
FROM monetized_events m
JOIN ad_sessions s ON s.ymid = m.ymid
WHERE s.request_var <> 'daily_mission';
DELETE FROM reward_ledger
WHERE ymid IN (
  SELECT m.ymid FROM monetized_events m
  JOIN ad_sessions s ON s.ymid = m.ymid
  WHERE s.request_var <> 'daily_mission'
);
DELETE FROM monetized_events
WHERE ymid IN (
  SELECT m.ymid FROM monetized_events m
  JOIN ad_sessions s ON s.ymid = m.ymid
  WHERE s.request_var <> 'daily_mission'
);
