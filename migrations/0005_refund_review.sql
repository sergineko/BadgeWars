ALTER TABLE bw_orders ADD COLUMN refunded_amount INTEGER NOT NULL DEFAULT 0 CHECK(refunded_amount>=0);
-- A fractional-credit refund still freezes the wallet. Never confiscate a whole
-- credit merely to round a provider's partial refund upwards.
CREATE TRIGGER bw_refund_review AFTER UPDATE OF refunded_amount ON bw_orders
WHEN NEW.refunded_amount>OLD.refunded_amount BEGIN
 UPDATE bw_wallets SET frozen=1 WHERE user_id=NEW.user_id;
 UPDATE bw_user_badges SET status='suspended' WHERE user_id=NEW.user_id;
 -- Recipients of support bought with a reversed wallet require review too.
 -- Points and contribution evidence remain intact for the operator to reconcile.
 UPDATE bw_user_badges SET status='suspended' WHERE id IN(SELECT holder_id FROM bw_contributors WHERE user_id=NEW.user_id);
 UPDATE bw_badges SET dirty=1,revision=revision+1 WHERE id IN(SELECT badge FROM bw_user_badges WHERE user_id=NEW.user_id OR id IN(SELECT holder_id FROM bw_contributors WHERE user_id=NEW.user_id));
 UPDATE bw_topups SET state='review' WHERE id=NEW.topup_id;
 INSERT INTO bw_operations(id,kind,reference) VALUES(lower(hex(randomblob(16))),'refund_review',NEW.id) ON CONFLICT(kind,reference) DO NOTHING;
END;
