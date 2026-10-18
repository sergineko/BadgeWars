-- Run once as the database owner on the existing self-hosted Supabase.
-- No changes to public, savetempo, auth, storage or PostgREST exposure.
BEGIN;
CREATE SCHEMA badgewars;
CREATE ROLE badgewars_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE TABLE badgewars.badges (
 id text PRIMARY KEY CHECK (id IN ('flex','bait','funded','quality','genesis')),
 amount integer NOT NULL DEFAULT 0 CHECK(amount>=0),
 owner text,
 sold integer NOT NULL DEFAULT 0 CHECK(sold BETWEEN 0 AND 10),
 revision bigint NOT NULL DEFAULT 0,
 dirty boolean NOT NULL DEFAULT true
);
INSERT INTO badgewars.badges(id) VALUES ('flex'),('bait'),('funded'),('quality'),('genesis');
CREATE TABLE badgewars.purchases (
 id uuid PRIMARY KEY,
 session_id text NOT NULL UNIQUE,
 payment_intent text NOT NULL UNIQUE,
 badge text NOT NULL REFERENCES badgewars.badges(id),
 owner text NOT NULL CHECK(owner ~ '^[A-Za-z0-9_]{2,24}$'),
 amount integer NOT NULL CHECK(amount BETWEEN 100 AND 10000000),
 status text NOT NULL CHECK(status IN ('accepted','refund_pending','refunded')),
 edition integer CHECK(edition BETWEEN 1 AND 10),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX genesis_edition ON badgewars.purchases(badge,edition) WHERE badge='genesis' AND status='accepted';
CREATE INDEX badge_rank ON badgewars.purchases(badge,amount DESC,created_at,id) WHERE status='accepted';
ALTER TABLE badgewars.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badgewars.purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA badgewars FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA badgewars FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA badgewars TO badgewars_app;
GRANT SELECT, UPDATE ON badgewars.badges TO badgewars_app;
GRANT SELECT, INSERT, UPDATE ON badgewars.purchases TO badgewars_app;
CREATE POLICY worker_badges ON badgewars.badges TO badgewars_app USING(true) WITH CHECK(true);
CREATE POLICY worker_purchases ON badgewars.purchases TO badgewars_app USING(true) WITH CHECK(true);
-- Provision a LOGIN role with a generated secret outside source control;
-- grant badgewars_app to it and use it in a NEW Hyperdrive with cache disabled.
-- This is a backend-only role. Never expose its credentials to the browser.
COMMIT;
