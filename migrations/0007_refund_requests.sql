-- Commercial non-delivery requests are reviewed before any money is returned.
ALTER TABLE bw_throttle ADD COLUMN expires INTEGER NOT NULL DEFAULT 0;
CREATE INDEX bw_throttle_expiry ON bw_throttle(expires);
CREATE TABLE bw_refund_requests(
 id TEXT PRIMARY KEY,topup_id TEXT NOT NULL UNIQUE REFERENCES bw_topups(id),
 user_id TEXT NOT NULL REFERENCES bw_users(id),order_id TEXT NOT NULL UNIQUE,
 amount INTEGER NOT NULL CHECK(amount>0),state TEXT NOT NULL DEFAULT 'review' CHECK(state IN('review','submitted','closed')),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER bw_refund_request_validate BEFORE INSERT ON bw_refund_requests BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM bw_topups WHERE id=NEW.topup_id AND user_id=NEW.user_id AND credits*100=NEW.amount) THEN RAISE(ABORT,'refund_not_found') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bw_orders WHERE topup_id=NEW.topup_id) OR EXISTS(SELECT 1 FROM bw_ledger WHERE reference='polar:'||NEW.order_id) THEN RAISE(ABORT,'refund_already_credited') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bw_ledger l JOIN bw_topups t ON t.id=NEW.topup_id WHERE l.user_id=NEW.user_id AND l.kind='spend' AND julianday(l.created_at)>=julianday(t.created_at)) THEN RAISE(ABORT,'refund_service_used') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM bw_wallets WHERE user_id=NEW.user_id AND debt=0 AND frozen=0 AND balance>=0) THEN RAISE(ABORT,'refund_wallet_unavailable') END;
END;
CREATE TRIGGER bw_refund_request_reserve AFTER INSERT ON bw_refund_requests BEGIN
 UPDATE bw_wallets SET frozen=1 WHERE user_id=NEW.user_id;
 UPDATE bw_topups SET state='review',checkout_url=NULL WHERE id=NEW.topup_id;
 INSERT INTO bw_operations(id,kind,reference) VALUES(NEW.id,'delivery_refund_review',NEW.topup_id) ON CONFLICT(kind,reference) DO NOTHING;
END;
-- Stop delivery racing a pending refund. External reversals are still reconciled.
CREATE TRIGGER bw_order_refund_reservation BEFORE INSERT ON bw_orders
WHEN EXISTS(SELECT 1 FROM bw_refund_requests WHERE topup_id=NEW.topup_id AND state IN('review','submitted')) BEGIN
 SELECT RAISE(ABORT,'refund_review_pending');
END;
CREATE TRIGGER bw_refund_request_identity BEFORE UPDATE ON bw_refund_requests
WHEN NEW.id<>OLD.id OR NEW.topup_id<>OLD.topup_id OR NEW.user_id<>OLD.user_id OR NEW.order_id<>OLD.order_id OR NEW.amount<>OLD.amount OR NEW.created_at<>OLD.created_at BEGIN
 SELECT RAISE(ABORT,'immutable_refund_request');
END;
