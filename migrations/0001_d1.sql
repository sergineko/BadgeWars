-- Dedicated BadgeWars D1 database. No PostgreSQL schema, role or remote connection.
PRAGMA foreign_keys=ON;
CREATE TABLE bw_users(id TEXT PRIMARY KEY,provider TEXT NOT NULL,subject TEXT NOT NULL,name TEXT NOT NULL,avatar_url TEXT,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),UNIQUE(provider,subject));
CREATE TABLE bw_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES bw_users(id),expires INTEGER NOT NULL);
CREATE INDEX bw_sessions_expiry ON bw_sessions(expires);
CREATE TABLE bw_oauth_states(state_hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);
CREATE TABLE bw_wallets(user_id TEXT PRIMARY KEY REFERENCES bw_users(id),balance INTEGER NOT NULL DEFAULT 0 CHECK(typeof(balance)='integer' AND balance BETWEEN 0 AND 9007199254740991),frozen INTEGER NOT NULL DEFAULT 0 CHECK(frozen IN(0,1)),debt INTEGER NOT NULL DEFAULT 0 CHECK(debt>=0));
CREATE TRIGGER bw_new_wallet AFTER INSERT ON bw_users BEGIN INSERT INTO bw_wallets(user_id) VALUES(NEW.id); END;
CREATE TABLE bw_badges(id TEXT PRIMARY KEY,base INTEGER NOT NULL,level INTEGER NOT NULL DEFAULT 0,owner TEXT,sold INTEGER NOT NULL DEFAULT 0 CHECK(sold BETWEEN 0 AND 10),revision INTEGER NOT NULL DEFAULT 1,dirty INTEGER NOT NULL DEFAULT 1,published_revision INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0);
INSERT INTO bw_badges(id,base) VALUES('flex',100),('bait',5),('funded',50),('quality',20),('genesis',1000);
CREATE TABLE bw_user_badges(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES bw_users(id),badge TEXT NOT NULL REFERENCES bw_badges(id),owner TEXT NOT NULL,level INTEGER NOT NULL,edition INTEGER,points TEXT NOT NULL DEFAULT '0' CHECK(points NOT GLOB '*[^0-9]*' AND length(points)>0),supporter_count INTEGER NOT NULL DEFAULT 0,show_top INTEGER NOT NULL DEFAULT 0 CHECK(show_top BETWEEN 0 AND 5),status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','suspended')),created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),UNIQUE(user_id,badge),UNIQUE(badge,edition));
CREATE INDEX bw_badge_levels ON bw_user_badges(badge,status,level DESC,updated_at,id);
CREATE INDEX bw_trust_rank ON bw_user_badges(badge,status,length(points) DESC,points DESC,created_at,id);
CREATE TABLE bw_contributors(holder_id TEXT NOT NULL REFERENCES bw_user_badges(id),user_id TEXT NOT NULL REFERENCES bw_users(id),alias TEXT NOT NULL,points TEXT NOT NULL DEFAULT '0',contributions INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),last_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),PRIMARY KEY(holder_id,user_id));
CREATE INDEX bw_contributors_rank ON bw_contributors(holder_id,length(points) DESC,points DESC,created_at,user_id);
CREATE TABLE bw_ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES bw_users(id),delta INTEGER NOT NULL CHECK(typeof(delta)='integer'),kind TEXT NOT NULL CHECK(kind IN('topup','spend','reversal')),reference TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX bw_ledger_user ON bw_ledger(user_id,created_at);
CREATE TRIGGER bw_ledger_validate BEFORE INSERT ON bw_ledger BEGIN
 SELECT CASE WHEN (NEW.kind='spend' AND (NEW.delta>=0 OR (SELECT frozen FROM bw_wallets WHERE user_id=NEW.user_id)=1)) OR (NEW.kind='topup' AND NEW.delta<=0) OR (NEW.kind='reversal' AND NEW.delta>0) THEN RAISE(ABORT,'wallet_frozen_or_invalid') END;
 SELECT CASE WHEN (SELECT balance FROM bw_wallets WHERE user_id=NEW.user_id)+NEW.delta<0 THEN RAISE(ABORT,'insufficient_credits') END;
END;
CREATE TRIGGER bw_ledger_apply AFTER INSERT ON bw_ledger BEGIN UPDATE bw_wallets SET balance=balance+NEW.delta WHERE user_id=NEW.user_id; END;
CREATE TRIGGER bw_ledger_immutable_update BEFORE UPDATE ON bw_ledger BEGIN SELECT RAISE(ABORT,'immutable_ledger'); END;
CREATE TRIGGER bw_ledger_immutable_delete BEFORE DELETE ON bw_ledger BEGIN SELECT RAISE(ABORT,'immutable_ledger'); END;
CREATE TABLE bw_actions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES bw_users(id),badge TEXT NOT NULL REFERENCES bw_badges(id),kind TEXT NOT NULL CHECK(kind IN('claim','support')),target_id TEXT,owner TEXT NOT NULL,level INTEGER NOT NULL CHECK(typeof(level)='integer' AND level BETWEEN 1 AND 1000000000),cost INTEGER NOT NULL CHECK(cost>0),holder_id TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX bw_actions_user ON bw_actions(user_id,created_at);
CREATE TRIGGER bw_action_validate BEFORE INSERT ON bw_actions BEGIN
 SELECT CASE WHEN NEW.kind='support' AND (NEW.badge<>'quality' OR NOT EXISTS(SELECT 1 FROM bw_user_badges WHERE id=NEW.target_id AND badge='quality' AND status='active' AND user_id<>NEW.user_id) OR NEW.cost<>NEW.level) THEN RAISE(ABORT,'invalid_support') END;
 SELECT CASE WHEN NEW.kind='claim' AND NEW.target_id IS NOT NULL THEN RAISE(ABORT,'invalid_target') END;
 SELECT CASE WHEN NEW.kind='claim' AND NEW.badge IN('flex','bait','funded') AND (NEW.level<(SELECT max(base,level+1) FROM bw_badges WHERE id=NEW.badge) OR NEW.cost<>NEW.level-coalesce((SELECT level FROM bw_user_badges WHERE user_id=NEW.user_id AND badge=NEW.badge),0)) THEN RAISE(ABORT,'price_changed') END;
 SELECT CASE WHEN NEW.kind='claim' AND NEW.badge IN('quality','genesis') AND (NEW.level<>(SELECT base FROM bw_badges WHERE id=NEW.badge) OR NEW.cost<>NEW.level OR EXISTS(SELECT 1 FROM bw_user_badges WHERE user_id=NEW.user_id AND badge=NEW.badge)) THEN RAISE(ABORT,'already_owned_or_invalid_price') END;
 SELECT CASE WHEN NEW.kind='claim' AND NEW.badge='genesis' AND (SELECT sold FROM bw_badges WHERE id='genesis')>=10 THEN RAISE(ABORT,'genesis_sold_out') END;
END;
CREATE TRIGGER bw_action_apply AFTER INSERT ON bw_actions BEGIN
 INSERT INTO bw_ledger(id,user_id,delta,kind,reference) VALUES(NEW.id,NEW.user_id,-NEW.cost,'spend','action:'||NEW.id);
 INSERT INTO bw_user_badges(id,user_id,badge,owner,level,edition)
 SELECT NEW.holder_id,NEW.user_id,NEW.badge,NEW.owner,NEW.level,CASE WHEN NEW.badge='genesis' THEN (SELECT sold+1 FROM bw_badges WHERE id='genesis') END WHERE NEW.kind='claim'
 ON CONFLICT(user_id,badge) DO UPDATE SET owner=excluded.owner,level=excluded.level,updated_at=NEW.created_at;
 INSERT INTO bw_contributors(holder_id,user_id,alias) SELECT NEW.target_id,NEW.user_id,NEW.owner WHERE NEW.kind='support' ON CONFLICT(holder_id,user_id) DO NOTHING;
 UPDATE bw_user_badges SET supporter_count=supporter_count+CASE WHEN (SELECT contributions FROM bw_contributors WHERE holder_id=NEW.target_id AND user_id=NEW.user_id)=0 THEN 1 ELSE 0 END WHERE id=NEW.target_id AND NEW.kind='support';
 UPDATE bw_user_badges SET points=(WITH RECURSIVE digits(i,carry,result) AS (SELECT 1,0,'' UNION ALL SELECT i+1,(CASE WHEN i<=length(points) THEN CAST(substr(points,length(points)-i+1,1) AS INTEGER) ELSE 0 END+CASE WHEN i<=length(CAST(NEW.level AS TEXT)) THEN CAST(substr(CAST(NEW.level AS TEXT),length(CAST(NEW.level AS TEXT))-i+1,1) AS INTEGER) ELSE 0 END+carry)/10,CAST((coalesce(CASE WHEN i<=length(points) THEN CAST(substr(points,length(points)-i+1,1) AS INTEGER) END,0)+CASE WHEN i<=length(CAST(NEW.level AS TEXT)) THEN CAST(substr(CAST(NEW.level AS TEXT),length(CAST(NEW.level AS TEXT))-i+1,1) AS INTEGER) ELSE 0 END+carry)%10 AS TEXT)||result FROM digits WHERE i<=max(length(points),length(CAST(NEW.level AS TEXT))) OR carry>0) SELECT coalesce(nullif(ltrim(result,'0'),''),'0') FROM digits ORDER BY i DESC LIMIT 1),updated_at=NEW.created_at WHERE id=NEW.target_id AND NEW.kind='support';
 UPDATE bw_contributors SET points=(WITH RECURSIVE digits(i,carry,result) AS (SELECT 1,0,'' UNION ALL SELECT i+1,(CASE WHEN i<=length(points) THEN CAST(substr(points,length(points)-i+1,1) AS INTEGER) ELSE 0 END+CASE WHEN i<=length(CAST(NEW.level AS TEXT)) THEN CAST(substr(CAST(NEW.level AS TEXT),length(CAST(NEW.level AS TEXT))-i+1,1) AS INTEGER) ELSE 0 END+carry)/10,CAST((coalesce(CASE WHEN i<=length(points) THEN CAST(substr(points,length(points)-i+1,1) AS INTEGER) END,0)+CASE WHEN i<=length(CAST(NEW.level AS TEXT)) THEN CAST(substr(CAST(NEW.level AS TEXT),length(CAST(NEW.level AS TEXT))-i+1,1) AS INTEGER) ELSE 0 END+carry)%10 AS TEXT)||result FROM digits WHERE i<=max(length(points),length(CAST(NEW.level AS TEXT))) OR carry>0) SELECT coalesce(nullif(ltrim(result,'0'),''),'0') FROM digits ORDER BY i DESC LIMIT 1),alias=NEW.owner,contributions=contributions+1,last_at=NEW.created_at WHERE holder_id=NEW.target_id AND user_id=NEW.user_id AND NEW.kind='support';
 UPDATE bw_badges SET level=CASE WHEN NEW.kind='claim' AND NEW.badge<>'quality' THEN NEW.level ELSE level END,owner=CASE WHEN NEW.kind='claim' THEN NEW.owner ELSE owner END,sold=sold+CASE WHEN NEW.kind='claim' AND NEW.badge='genesis' THEN 1 ELSE 0 END,revision=revision+1,dirty=1 WHERE id=NEW.badge;
END;
CREATE TRIGGER bw_actions_immutable_update BEFORE UPDATE ON bw_actions BEGIN SELECT RAISE(ABORT,'immutable_action'); END;
CREATE TRIGGER bw_actions_immutable_delete BEFORE DELETE ON bw_actions BEGIN SELECT RAISE(ABORT,'immutable_action'); END;
CREATE TABLE bw_topups(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES bw_users(id),credits INTEGER NOT NULL CHECK(typeof(credits)='integer' AND credits BETWEEN 5 AND 100000),currency TEXT NOT NULL CHECK(currency IN('usd','eur')),product_id TEXT NOT NULL,locale TEXT NOT NULL DEFAULT 'es',state TEXT NOT NULL DEFAULT 'creating',checkout_id TEXT UNIQUE,checkout_url TEXT,terms_version TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),next_check INTEGER NOT NULL DEFAULT 0,errors INTEGER NOT NULL DEFAULT 0);
CREATE INDEX bw_topups_recovery ON bw_topups(state,next_check);
CREATE TABLE bw_orders(id TEXT PRIMARY KEY,topup_id TEXT NOT NULL UNIQUE REFERENCES bw_topups(id),user_id TEXT NOT NULL REFERENCES bw_users(id),credits INTEGER NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,checkout_id TEXT NOT NULL,product_id TEXT NOT NULL,reversed INTEGER NOT NULL DEFAULT 0 CHECK(reversed BETWEEN 0 AND credits),created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TRIGGER bw_order_credit AFTER INSERT ON bw_orders BEGIN
 INSERT INTO bw_ledger(id,user_id,delta,kind,reference) VALUES(NEW.id,NEW.user_id,NEW.credits,'topup','polar:'||NEW.id);
 UPDATE bw_topups SET state='accepted',checkout_url=NULL,checkout_id=NEW.checkout_id WHERE id=NEW.topup_id;
END;
CREATE TRIGGER bw_order_reverse AFTER UPDATE OF reversed ON bw_orders WHEN NEW.reversed>OLD.reversed BEGIN
 UPDATE bw_wallets SET debt=debt+max(NEW.reversed-OLD.reversed-balance,0),frozen=1 WHERE user_id=NEW.user_id;
 INSERT INTO bw_ledger(id,user_id,delta,kind,reference) SELECT lower(hex(randomblob(16))),NEW.user_id,-min(balance,NEW.reversed-OLD.reversed),'reversal','polar-reversal:'||NEW.id||':'||NEW.reversed FROM bw_wallets WHERE user_id=NEW.user_id;
 UPDATE bw_user_badges SET status='suspended' WHERE user_id=NEW.user_id;
 UPDATE bw_badges SET dirty=1,revision=revision+1 WHERE id IN(SELECT badge FROM bw_user_badges WHERE user_id=NEW.user_id);
 UPDATE bw_topups SET state='review' WHERE id=NEW.topup_id;
END;
CREATE TABLE bw_webhooks(id TEXT PRIMARY KEY,type TEXT NOT NULL,resource_id TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_check INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX bw_webhooks_pending ON bw_webhooks(state,next_check);
CREATE TABLE bw_operations(id TEXT PRIMARY KEY,kind TEXT NOT NULL,reference TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),UNIQUE(kind,reference));
CREATE TABLE bw_throttle(key TEXT PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL);
