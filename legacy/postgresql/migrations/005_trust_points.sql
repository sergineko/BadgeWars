BEGIN;
-- Exact cumulative cents, without a product cap or JavaScript integer ceiling.
ALTER TABLE badgewars.user_badges DROP CONSTRAINT user_badges_support_amount_check;
ALTER TABLE badgewars.user_badges ALTER COLUMN support_amount TYPE numeric USING support_amount::numeric;
ALTER TABLE badgewars.user_badges ADD CONSTRAINT support_amount_nonnegative
 CHECK(support_amount>=0 AND support_amount=trunc(support_amount) AND mod(support_amount,100)=0);
ALTER TABLE badgewars.purchases ADD CONSTRAINT support_whole_points
 CHECK(kind<>'support' OR (user_id IS NOT NULL AND mod(amount,100)=0));
CREATE INDEX trust_points_rank ON badgewars.user_badges(support_amount DESC,created_at,id) WHERE badge='quality';
UPDATE badgewars.badges SET dirty=true,revision=revision+1 WHERE id='quality';
COMMIT;
