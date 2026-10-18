BEGIN;
ALTER TABLE badgewars.purchases DROP CONSTRAINT purchases_status_check;
ALTER TABLE badgewars.purchases ADD CONSTRAINT purchases_status_check CHECK(status IN ('accepted','refund_pending','refunded','refund_failed'));
ALTER TABLE badgewars.purchases ADD COLUMN refund_id text UNIQUE;
ALTER TABLE badgewars.purchases ADD COLUMN refund_status text;
ALTER TABLE badgewars.purchases ADD COLUMN refund_checked_at timestamptz;
ALTER TABLE badgewars.purchases ADD COLUMN refund_errors integer NOT NULL DEFAULT 0;
CREATE TABLE badgewars.checkout_attempts (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL,
 badge text NOT NULL REFERENCES badgewars.badges(id),
 owner text NOT NULL CHECK(owner ~ '^[A-Za-z0-9_]{2,24}$'),
 amount integer NOT NULL CHECK(amount BETWEEN 100 AND 10000000),
 currency text NOT NULL CHECK(currency IN ('usd','eur')),
 locale text NOT NULL CHECK(locale IN ('es','en')),
 app_url text NOT NULL,
 session_id text UNIQUE,
 checkout_url text,
 state text NOT NULL DEFAULT 'creating' CHECK(state IN ('creating','open','complete','expired','review')),
 errors integer NOT NULL DEFAULT 0,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 next_check timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX checkout_due ON badgewars.checkout_attempts(next_check) WHERE state IN ('creating','open');
CREATE INDEX checkout_user ON badgewars.checkout_attempts(user_id,created_at DESC);
ALTER TABLE badgewars.checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON badgewars.checkout_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON badgewars.checkout_attempts TO badgewars_app;
CREATE POLICY worker_checkout ON badgewars.checkout_attempts TO badgewars_app USING(true) WITH CHECK(true);
-- A deterministic order supports private cursor pagination, including tied timestamps.
CREATE INDEX purchases_user_cursor ON badgewars.purchases(user_id,created_at DESC,id DESC);
CREATE VIEW badgewars.operations_queue WITH(security_invoker=true) AS
 SELECT 'checkout'::text AS kind,id::text AS reference,state AS status,last_error AS reason,created_at
 FROM badgewars.checkout_attempts WHERE state='review'
 UNION ALL
 SELECT 'refund',id::text,status,refund_status,created_at FROM badgewars.purchases WHERE status='refund_failed';
REVOKE ALL ON badgewars.operations_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT ON badgewars.operations_queue TO badgewars_app;
COMMIT;
