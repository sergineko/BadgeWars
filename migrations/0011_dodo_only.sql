-- Retire compatibility paths. Previously applied migrations remain immutable.
CREATE TRIGGER bw_dodo_topups_only BEFORE INSERT ON bw_topups
WHEN NEW.provider<>'dodo' OR NEW.environment NOT IN('test_mode','live_mode') BEGIN
 SELECT RAISE(ABORT,'invalid_payment_environment');
END;
CREATE TRIGGER bw_dodo_orders_only BEFORE INSERT ON bw_orders
WHEN NEW.provider<>'dodo' OR NEW.environment NOT IN('test_mode','live_mode')
 OR NOT EXISTS(SELECT 1 FROM bw_topups WHERE id=NEW.topup_id AND user_id=NEW.user_id AND provider=NEW.provider AND environment=NEW.environment)
BEGIN SELECT RAISE(ABORT,'invalid_payment_environment'); END;
CREATE TRIGGER bw_dodo_webhooks_only BEFORE INSERT ON bw_webhooks
WHEN NEW.provider<>'dodo' OR NEW.environment NOT IN('test_mode','live_mode') BEGIN
 SELECT RAISE(ABORT,'invalid_payment_environment');
END;
DROP TRIGGER bw_order_credit;
CREATE TRIGGER bw_order_credit AFTER INSERT ON bw_orders BEGIN
 INSERT INTO bw_ledger(id,user_id,delta,kind,reference) VALUES(NEW.id,NEW.user_id,NEW.credits,'topup',NEW.id);
 UPDATE bw_topups SET state='accepted',checkout_url=NULL,checkout_id=NEW.checkout_id WHERE id=NEW.topup_id;
END;
DROP TRIGGER bw_order_reverse;
CREATE TRIGGER bw_order_reverse AFTER UPDATE OF reversed ON bw_orders WHEN NEW.reversed>OLD.reversed BEGIN
 UPDATE bw_wallets SET debt=debt+max(NEW.reversed-OLD.reversed-balance,0),frozen=1 WHERE user_id=NEW.user_id;
 INSERT INTO bw_ledger(id,user_id,delta,kind,reference) SELECT lower(hex(randomblob(16))),NEW.user_id,-min(balance,NEW.reversed-OLD.reversed),'reversal','reversal:'||NEW.id||':'||NEW.reversed FROM bw_wallets WHERE user_id=NEW.user_id;
 UPDATE bw_user_badges SET status='suspended' WHERE user_id=NEW.user_id;
 UPDATE bw_badges SET dirty=1,revision=revision+1 WHERE id IN(SELECT badge FROM bw_user_badges WHERE user_id=NEW.user_id);
 UPDATE bw_topups SET state='review' WHERE id=NEW.topup_id;
END;
DROP TRIGGER bw_refund_request_validate;
CREATE TRIGGER bw_refund_request_validate BEFORE INSERT ON bw_refund_requests BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM bw_topups WHERE id=NEW.topup_id AND user_id=NEW.user_id AND credits*100=NEW.amount) THEN RAISE(ABORT,'refund_not_found') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bw_orders WHERE topup_id=NEW.topup_id) OR EXISTS(SELECT 1 FROM bw_ledger WHERE reference=NEW.order_id) THEN RAISE(ABORT,'refund_already_credited') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM bw_ledger l JOIN bw_topups t ON t.id=NEW.topup_id WHERE l.user_id=NEW.user_id AND l.kind='spend' AND julianday(l.created_at)>=julianday(t.created_at)) THEN RAISE(ABORT,'refund_service_used') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM bw_wallets WHERE user_id=NEW.user_id AND debt=0 AND frozen=0 AND balance>=0) THEN RAISE(ABORT,'refund_wallet_unavailable') END;
END;
