-- Monitoring must read only affected wallets, not scan the healthy population.
DROP INDEX bw_wallets_review;
CREATE INDEX bw_wallets_open_review ON bw_wallets(user_id) WHERE frozen=1 OR debt>0;
