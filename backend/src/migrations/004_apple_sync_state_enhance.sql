ALTER TABLE apple_sync_state ADD COLUMN last_sync_status TEXT CHECK(last_sync_status IN ('success', 'error'));
ALTER TABLE apple_sync_state ADD COLUMN metric_counts_json TEXT;
ALTER TABLE apple_sync_state ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE apple_sync_state ADD COLUMN last_error TEXT;
