-- Apply after 001. Auth identities live in Supabase Auth; business data stays here.
BEGIN;
ALTER TABLE badgewars.purchases ADD COLUMN user_id uuid;
ALTER TABLE badgewars.purchases ADD COLUMN currency text NOT NULL DEFAULT 'usd' CHECK(currency IN ('usd','eur'));
-- Never rewrite existing paid amounts or currencies. This repository has no live sales.
CREATE INDEX purchases_by_user ON badgewars.purchases(user_id,created_at DESC);
CREATE UNIQUE INDEX one_genesis_per_account ON badgewars.purchases(user_id)
 WHERE badge='genesis' AND status='accepted' AND user_id IS NOT NULL;
ALTER TABLE badgewars.purchases ADD CONSTRAINT new_genesis_price CHECK
 (badge<>'genesis' OR user_id IS NULL OR (currency='eur' AND amount=100000));
UPDATE badgewars.badges SET dirty=true;
COMMIT;
