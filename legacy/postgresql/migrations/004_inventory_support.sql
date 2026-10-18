BEGIN;
CREATE TABLE badgewars.user_badges (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL,
 badge text NOT NULL REFERENCES badgewars.badges(id),
 current_purchase_id uuid NOT NULL UNIQUE REFERENCES badgewars.purchases(id),
 show_top smallint NOT NULL DEFAULT 0 CHECK(show_top BETWEEN 0 AND 5),
 support_amount bigint NOT NULL DEFAULT 0 CHECK(support_amount BETWEEN 0 AND 9007199254740991),
 contributor_count integer NOT NULL DEFAULT 0 CHECK(contributor_count>=0),
 avatar_url text CHECK(avatar_url IS NULL OR (length(avatar_url)<=2048 AND avatar_url LIKE 'https://%')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,badge)
);
-- Keep the first issued URL stable, pointing at the user's current accepted purchase.
WITH ranked AS (
 SELECT p.*,first_value(id) OVER(PARTITION BY user_id,badge ORDER BY created_at,id) AS holder_id,
 row_number() OVER(PARTITION BY user_id,badge ORDER BY amount DESC,created_at DESC,id DESC) AS current_row
 FROM badgewars.purchases p WHERE user_id IS NOT NULL AND status='accepted'
)
INSERT INTO badgewars.user_badges(id,user_id,badge,current_purchase_id,created_at)
SELECT holder_id,user_id,badge,id,created_at FROM ranked WHERE current_row=1;
ALTER TABLE badgewars.purchases ADD COLUMN kind text NOT NULL DEFAULT 'claim' CHECK(kind IN ('claim','support'));
ALTER TABLE badgewars.purchases ADD COLUMN target_badge_id uuid REFERENCES badgewars.user_badges(id);
ALTER TABLE badgewars.purchases ADD CONSTRAINT purchase_target CHECK
 ((kind='claim' AND target_badge_id IS NULL) OR (kind='support' AND badge='quality' AND target_badge_id IS NOT NULL));
ALTER TABLE badgewars.checkout_attempts ADD COLUMN kind text NOT NULL DEFAULT 'claim' CHECK(kind IN ('claim','support'));
ALTER TABLE badgewars.checkout_attempts ADD COLUMN avatar_url text;
ALTER TABLE badgewars.checkout_attempts ADD COLUMN target_badge_id uuid REFERENCES badgewars.user_badges(id);
ALTER TABLE badgewars.checkout_attempts ADD CONSTRAINT checkout_target CHECK
 ((kind='claim' AND target_badge_id IS NULL) OR (kind='support' AND badge='quality' AND target_badge_id IS NOT NULL));
CREATE INDEX support_by_target ON badgewars.purchases(target_badge_id,user_id,created_at DESC)
 WHERE kind='support' AND status='accepted';
ALTER TABLE badgewars.user_badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON badgewars.user_badges FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON badgewars.user_badges TO badgewars_app;
CREATE POLICY worker_inventory ON badgewars.user_badges TO badgewars_app USING(true) WITH CHECK(true);
UPDATE badgewars.badges SET dirty=true;
COMMIT;
