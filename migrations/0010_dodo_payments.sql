-- Preserve Polar history and accepted documents. Never reinterpret old payments.
ALTER TABLE bw_topups ADD COLUMN provider TEXT NOT NULL DEFAULT 'polar' CHECK(provider IN('polar','dodo'));
ALTER TABLE bw_topups ADD COLUMN environment TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE bw_topups ADD COLUMN customer_id TEXT;
ALTER TABLE bw_orders ADD COLUMN provider TEXT NOT NULL DEFAULT 'polar' CHECK(provider IN('polar','dodo'));
ALTER TABLE bw_orders ADD COLUMN environment TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE bw_orders ADD COLUMN external_id TEXT NOT NULL DEFAULT '';
ALTER TABLE bw_orders ADD COLUMN next_check INTEGER NOT NULL DEFAULT 0;
CREATE INDEX bw_dodo_order_recovery ON bw_orders(provider,environment,next_check);
ALTER TABLE bw_webhooks ADD COLUMN provider TEXT NOT NULL DEFAULT 'polar';
ALTER TABLE bw_webhooks ADD COLUMN environment TEXT NOT NULL DEFAULT 'sandbox';
CREATE UNIQUE INDEX bw_order_provider_reference ON bw_orders(provider,environment,external_id) WHERE external_id<>'';
CREATE TABLE bw_payment_customers(user_id TEXT NOT NULL REFERENCES bw_users(id),provider TEXT NOT NULL,environment TEXT NOT NULL,customer_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),PRIMARY KEY(user_id,provider,environment,customer_id));
DROP TRIGGER bw_order_credit;
CREATE TRIGGER bw_order_credit AFTER INSERT ON bw_orders BEGIN
 INSERT INTO bw_ledger(id,user_id,delta,kind,reference) VALUES(NEW.id,NEW.user_id,NEW.credits,'topup',CASE WHEN NEW.provider='dodo' THEN NEW.id ELSE 'polar:'||NEW.id END);
 UPDATE bw_topups SET state='accepted',checkout_url=NULL,checkout_id=NEW.checkout_id WHERE id=NEW.topup_id;
END;
-- Reversal references inherit the namespaced order id; historical references stay intact.
DROP TRIGGER bw_order_reverse;
CREATE TRIGGER bw_order_reverse AFTER UPDATE OF reversed ON bw_orders WHEN NEW.reversed>OLD.reversed BEGIN
 UPDATE bw_wallets SET debt=debt+max(NEW.reversed-OLD.reversed-balance,0),frozen=1 WHERE user_id=NEW.user_id;
 INSERT INTO bw_ledger(id,user_id,delta,kind,reference) SELECT lower(hex(randomblob(16))),NEW.user_id,-min(balance,NEW.reversed-OLD.reversed),'reversal',CASE WHEN NEW.provider='dodo' THEN 'reversal:'||NEW.id ELSE 'polar-reversal:'||NEW.id END||':'||NEW.reversed FROM bw_wallets WHERE user_id=NEW.user_id;
 UPDATE bw_user_badges SET status='suspended' WHERE user_id=NEW.user_id;
 UPDATE bw_badges SET dirty=1,revision=revision+1 WHERE id IN(SELECT badge FROM bw_user_badges WHERE user_id=NEW.user_id);
 UPDATE bw_topups SET state='review' WHERE id=NEW.topup_id;
END;
