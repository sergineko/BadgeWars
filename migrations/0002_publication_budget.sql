ALTER TABLE bw_badges ADD COLUMN published_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bw_badges ADD COLUMN lease_token TEXT;
CREATE TABLE bw_kv_budget(day TEXT PRIMARY KEY,writes INTEGER NOT NULL DEFAULT 0 CHECK(writes BETWEEN 0 AND 900));
CREATE INDEX bw_oauth_expiry ON bw_oauth_states(expires);
CREATE INDEX bw_throttle_cleanup ON bw_throttle(window);
