-- Individual developer badges and independent Apex Flex seasons.
-- Rebuild only the entitlement uniqueness constraint; retain every ID and timestamp.
-- D1 applies migrations transactionally; deferred FKs retain contributor references.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE bw_flex_seasons(id TEXT PRIMARY KEY,number INTEGER NOT NULL UNIQUE CHECK(number>0),design TEXT NOT NULL UNIQUE,name TEXT NOT NULL,starts_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),ends_at TEXT,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN('open','closed')),closed_at TEXT,operator_actor TEXT NOT NULL DEFAULT 'system',operator_note TEXT NOT NULL DEFAULT '',CHECK(ends_at IS NULL OR julianday(ends_at)>julianday(starts_at)),CHECK((status='open' AND closed_at IS NULL) OR (status='closed' AND closed_at IS NOT NULL)));
CREATE UNIQUE INDEX bw_one_open_season ON bw_flex_seasons(status) WHERE status='open';
CREATE TABLE bw_season_events(id TEXT PRIMARY KEY,season_id TEXT NOT NULL REFERENCES bw_flex_seasons(id),actor TEXT NOT NULL,note TEXT NOT NULL,state TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE TRIGGER bw_season_audit_insert AFTER INSERT ON bw_flex_seasons BEGIN INSERT INTO bw_season_events(id,season_id,actor,note,state) VALUES(lower(hex(randomblob(16))),NEW.id,NEW.operator_actor,NEW.operator_note,json_object('status',NEW.status,'endsAt',NEW.ends_at,'design',NEW.design,'closedAt',NEW.closed_at)); END;
CREATE TRIGGER bw_season_audit_update AFTER UPDATE ON bw_flex_seasons BEGIN INSERT INTO bw_season_events(id,season_id,actor,note,state) VALUES(lower(hex(randomblob(16))),NEW.id,NEW.operator_actor,NEW.operator_note,json_object('status',NEW.status,'endsAt',NEW.ends_at,'design',NEW.design,'closedAt',NEW.closed_at)); END;
CREATE TRIGGER bw_season_publish AFTER UPDATE ON bw_flex_seasons BEGIN UPDATE bw_badges SET dirty=1,revision=revision+1 WHERE id='flex'; END;
CREATE TRIGGER bw_season_events_immutable_update BEFORE UPDATE ON bw_season_events BEGIN SELECT RAISE(ABORT,'immutable_season_event'); END;
CREATE TRIGGER bw_season_events_immutable_delete BEFORE DELETE ON bw_season_events BEGIN SELECT RAISE(ABORT,'immutable_season_event'); END;
INSERT INTO bw_flex_seasons(id,number,design,name,starts_at) VALUES('apex-1',1,'apex-1','Season 1','2026-10-16T00:00:00.000Z');
DROP TRIGGER bw_action_validate;
DROP TRIGGER bw_action_apply;
DROP TRIGGER bw_recompute_leader;
DROP TRIGGER bw_refund_review;
DROP TRIGGER bw_order_reverse;
CREATE TABLE bw_user_badges_next(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES bw_users(id),badge TEXT NOT NULL REFERENCES bw_badges(id),owner TEXT NOT NULL,level INTEGER NOT NULL,edition INTEGER,points TEXT NOT NULL DEFAULT '0' CHECK(points NOT GLOB '*[^0-9]*' AND length(points)>0),supporter_count INTEGER NOT NULL DEFAULT 0,show_top INTEGER NOT NULL DEFAULT 0 CHECK(show_top BETWEEN 0 AND 5),status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','suspended')),created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),season_id TEXT REFERENCES bw_flex_seasons(id),CHECK((badge='flex' AND season_id IS NOT NULL) OR (badge<>'flex' AND season_id IS NULL)),UNIQUE(badge,edition));
INSERT INTO bw_user_badges_next(id,user_id,badge,owner,level,edition,points,supporter_count,show_top,status,created_at,updated_at,season_id) SELECT id,user_id,badge,owner,level,edition,points,supporter_count,show_top,status,created_at,updated_at,CASE WHEN badge='flex' THEN 'apex-1' END FROM bw_user_badges;
DROP TABLE bw_user_badges;
ALTER TABLE bw_user_badges_next RENAME TO bw_user_badges;
CREATE UNIQUE INDEX bw_one_badge_per_family ON bw_user_badges(user_id,badge) WHERE badge<>'flex';
CREATE UNIQUE INDEX bw_one_flex_per_season ON bw_user_badges(user_id,season_id) WHERE badge='flex';
CREATE INDEX bw_badge_levels ON bw_user_badges(badge,status,level DESC,updated_at,id);
CREATE INDEX bw_trust_rank ON bw_user_badges(badge,status,length(points) DESC,points DESC,created_at,id);
CREATE INDEX bw_flex_season_rank ON bw_user_badges(season_id,status,level DESC,updated_at,id);
ALTER TABLE bw_actions ADD COLUMN season_id TEXT REFERENCES bw_flex_seasons(id);
CREATE TABLE bw_flex_results(holder_id TEXT PRIMARY KEY REFERENCES bw_user_badges(id),season_id TEXT NOT NULL REFERENCES bw_flex_seasons(id),rank INTEGER,level INTEGER NOT NULL,owner TEXT NOT NULL,UNIQUE(season_id,rank));
CREATE TRIGGER bw_results_immutable_update BEFORE UPDATE ON bw_flex_results BEGIN SELECT RAISE(ABORT,'immutable_season_result'); END;
CREATE TRIGGER bw_results_immutable_delete BEFORE DELETE ON bw_flex_results BEGIN SELECT RAISE(ABORT,'immutable_season_result'); END;
CREATE TRIGGER bw_season_closed_immutable BEFORE UPDATE ON bw_flex_seasons WHEN OLD.status='closed' BEGIN SELECT RAISE(ABORT,'season_closed'); END;
CREATE TRIGGER bw_season_identity BEFORE UPDATE ON bw_flex_seasons WHEN NEW.id<>OLD.id OR NEW.number<>OLD.number OR NEW.design<>OLD.design OR NEW.starts_at<>OLD.starts_at BEGIN SELECT RAISE(ABORT,'immutable_season_identity'); END;
CREATE TRIGGER bw_season_no_delete BEFORE DELETE ON bw_flex_seasons BEGIN SELECT RAISE(ABORT,'immutable_season'); END;
CREATE TRIGGER bw_season_close AFTER UPDATE OF status ON bw_flex_seasons WHEN OLD.status='open' AND NEW.status='closed' BEGIN
 INSERT INTO bw_flex_results(holder_id,season_id,rank,level,owner)
 SELECT u.id,u.season_id,r.rank,u.level,u.owner FROM bw_user_badges u LEFT JOIN (SELECT b.id,row_number() OVER(ORDER BY b.level DESC,b.updated_at,b.id) AS rank FROM bw_user_badges b JOIN bw_wallets w ON w.user_id=b.user_id WHERE b.season_id=NEW.id AND b.status='active' AND w.frozen=0 AND w.debt=0) r ON r.id=u.id WHERE u.season_id=NEW.id;
 UPDATE bw_badges SET dirty=1,revision=revision+1 WHERE id='flex';
END;
CREATE TRIGGER bw_season_open AFTER INSERT ON bw_flex_seasons WHEN NEW.status='open' BEGIN
 UPDATE bw_badges SET level=0,owner=NULL,dirty=1,revision=revision+1 WHERE id='flex';
END;
CREATE TRIGGER bw_closed_flex_identity BEFORE UPDATE OF level,owner,season_id ON bw_user_badges WHEN OLD.badge='flex' AND EXISTS(SELECT 1 FROM bw_flex_results WHERE holder_id=OLD.id) BEGIN SELECT RAISE(ABORT,'immutable_season_result'); END;
CREATE TRIGGER bw_flex_deadline BEFORE UPDATE OF status ON bw_user_badges WHEN OLD.badge='flex' BEGIN
 UPDATE bw_flex_seasons SET status='closed',closed_at=ends_at WHERE id=OLD.season_id AND status='open' AND ends_at IS NOT NULL AND julianday(ends_at)<=julianday('now');
END;
CREATE TRIGGER bw_flex_deadline_wallet BEFORE UPDATE OF frozen,debt ON bw_wallets BEGIN
 UPDATE bw_flex_seasons SET status='closed',closed_at=ends_at,operator_actor='system',operator_note='Deadline before wallet review' WHERE status='open' AND ends_at IS NOT NULL AND julianday(ends_at)<=julianday('now');
END;
CREATE TRIGGER bw_action_validate BEFORE INSERT ON bw_actions BEGIN
 SELECT CASE WHEN NEW.badge='flex' AND NOT EXISTS(SELECT 1 FROM bw_flex_seasons WHERE id=NEW.season_id AND status='open' AND julianday(starts_at)<=julianday('now') AND (ends_at IS NULL OR julianday(ends_at)>julianday('now'))) THEN RAISE(ABORT,'season_closed') END;
 SELECT CASE WHEN NEW.badge<>'flex' AND NEW.season_id IS NOT NULL THEN RAISE(ABORT,'invalid_season') END;
 SELECT CASE WHEN NEW.kind='support' AND (NEW.badge<>'quality' OR NOT EXISTS(SELECT 1 FROM bw_user_badges WHERE id=NEW.target_id AND badge='quality' AND status='active' AND user_id<>NEW.user_id) OR NEW.cost<>NEW.level) THEN RAISE(ABORT,'invalid_support') END;
 SELECT CASE WHEN NEW.kind='claim' AND NEW.target_id IS NOT NULL THEN RAISE(ABORT,'invalid_target') END;
 SELECT CASE WHEN NEW.kind='claim' AND NEW.badge IN('flex','bait') AND (NEW.level<(SELECT max(base,level+1) FROM bw_badges WHERE id=NEW.badge) OR NEW.cost<>NEW.level-coalesce((SELECT level FROM bw_user_badges WHERE user_id=NEW.user_id AND badge=NEW.badge AND season_id IS NEW.season_id),0)) THEN RAISE(ABORT,'price_changed') END;
 SELECT CASE WHEN NEW.kind='claim' AND NEW.badge IN('quality','genesis','funded') AND (NEW.level<>(SELECT base FROM bw_badges WHERE id=NEW.badge) OR NEW.cost<>NEW.level OR EXISTS(SELECT 1 FROM bw_user_badges WHERE user_id=NEW.user_id AND badge=NEW.badge AND season_id IS NEW.season_id)) THEN RAISE(ABORT,'already_owned_or_invalid_price') END;
 SELECT CASE WHEN NEW.kind='claim' AND NEW.badge='genesis' AND (SELECT sold FROM bw_badges WHERE id='genesis')>=10 THEN RAISE(ABORT,'genesis_sold_out') END;
END;
CREATE TRIGGER bw_action_apply AFTER INSERT ON bw_actions BEGIN
 INSERT INTO bw_ledger(id,user_id,delta,kind,reference) VALUES(NEW.id,NEW.user_id,-NEW.cost,'spend','action:'||NEW.id);
 UPDATE bw_user_badges SET owner=NEW.owner,level=NEW.level,updated_at=NEW.created_at WHERE id=NEW.holder_id AND NEW.kind='claim';
 INSERT INTO bw_user_badges(id,user_id,badge,owner,level,edition,season_id)
 SELECT NEW.holder_id,NEW.user_id,NEW.badge,NEW.owner,NEW.level,CASE WHEN NEW.badge='genesis' THEN (SELECT sold+1 FROM bw_badges WHERE id='genesis') END,NEW.season_id WHERE NEW.kind='claim' AND NOT EXISTS(SELECT 1 FROM bw_user_badges WHERE id=NEW.holder_id);
 INSERT INTO bw_contributors(holder_id,user_id,alias) SELECT NEW.target_id,NEW.user_id,NEW.owner WHERE NEW.kind='support' ON CONFLICT(holder_id,user_id) DO NOTHING;
 UPDATE bw_user_badges SET supporter_count=supporter_count+CASE WHEN (SELECT contributions FROM bw_contributors WHERE holder_id=NEW.target_id AND user_id=NEW.user_id)=0 THEN 1 ELSE 0 END WHERE id=NEW.target_id AND NEW.kind='support';
 UPDATE bw_user_badges SET points=(WITH RECURSIVE digits(i,carry,result) AS (SELECT 1,0,'' UNION ALL SELECT i+1,(CASE WHEN i<=length(points) THEN CAST(substr(points,length(points)-i+1,1) AS INTEGER) ELSE 0 END+CASE WHEN i<=length(CAST(NEW.level AS TEXT)) THEN CAST(substr(CAST(NEW.level AS TEXT),length(CAST(NEW.level AS TEXT))-i+1,1) AS INTEGER) ELSE 0 END+carry)/10,CAST((coalesce(CASE WHEN i<=length(points) THEN CAST(substr(points,length(points)-i+1,1) AS INTEGER) END,0)+CASE WHEN i<=length(CAST(NEW.level AS TEXT)) THEN CAST(substr(CAST(NEW.level AS TEXT),length(CAST(NEW.level AS TEXT))-i+1,1) AS INTEGER) ELSE 0 END+carry)%10 AS TEXT)||result FROM digits WHERE i<=max(length(points),length(CAST(NEW.level AS TEXT))) OR carry>0) SELECT coalesce(nullif(ltrim(result,'0'),''),'0') FROM digits ORDER BY i DESC LIMIT 1),updated_at=NEW.created_at WHERE id=NEW.target_id AND NEW.kind='support';
 UPDATE bw_contributors SET points=(WITH RECURSIVE digits(i,carry,result) AS (SELECT 1,0,'' UNION ALL SELECT i+1,(CASE WHEN i<=length(points) THEN CAST(substr(points,length(points)-i+1,1) AS INTEGER) ELSE 0 END+CASE WHEN i<=length(CAST(NEW.level AS TEXT)) THEN CAST(substr(CAST(NEW.level AS TEXT),length(CAST(NEW.level AS TEXT))-i+1,1) AS INTEGER) ELSE 0 END+carry)/10,CAST((coalesce(CASE WHEN i<=length(points) THEN CAST(substr(points,length(points)-i+1,1) AS INTEGER) END,0)+CASE WHEN i<=length(CAST(NEW.level AS TEXT)) THEN CAST(substr(CAST(NEW.level AS TEXT),length(CAST(NEW.level AS TEXT))-i+1,1) AS INTEGER) ELSE 0 END+carry)%10 AS TEXT)||result FROM digits WHERE i<=max(length(points),length(CAST(NEW.level AS TEXT))) OR carry>0) SELECT coalesce(nullif(ltrim(result,'0'),''),'0') FROM digits ORDER BY i DESC LIMIT 1),alias=NEW.owner,contributions=contributions+1,last_at=NEW.created_at WHERE holder_id=NEW.target_id AND user_id=NEW.user_id AND NEW.kind='support';
 UPDATE bw_badges SET level=CASE WHEN NEW.kind='claim' AND NEW.badge IN('flex','bait') THEN NEW.level ELSE level END,owner=CASE WHEN NEW.kind='claim' AND NEW.badge IN('flex','bait') THEN NEW.owner ELSE owner END,sold=sold+CASE WHEN NEW.kind='claim' AND NEW.badge='genesis' THEN 1 ELSE 0 END,revision=revision+1,dirty=1 WHERE id=NEW.badge;
END;
CREATE TRIGGER bw_recompute_leader AFTER UPDATE OF status ON bw_user_badges WHEN NEW.badge IN('flex','bait') AND NEW.status<>OLD.status BEGIN
 UPDATE bw_badges SET level=coalesce((SELECT max(level) FROM bw_user_badges WHERE badge=NEW.badge AND status='active' AND (NEW.badge<>'flex' OR season_id=(SELECT id FROM bw_flex_seasons WHERE status='open'))),0),owner=(SELECT owner FROM bw_user_badges WHERE badge=NEW.badge AND status='active' AND (NEW.badge<>'flex' OR season_id=(SELECT id FROM bw_flex_seasons WHERE status='open')) ORDER BY level DESC,updated_at,id LIMIT 1),dirty=1,revision=revision+1 WHERE id=NEW.badge;
END;
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
CREATE TRIGGER bw_order_reverse AFTER UPDATE OF reversed ON bw_orders WHEN NEW.reversed>OLD.reversed BEGIN
 UPDATE bw_wallets SET debt=debt+max(NEW.reversed-OLD.reversed-balance,0),frozen=1 WHERE user_id=NEW.user_id;
 INSERT INTO bw_ledger(id,user_id,delta,kind,reference) SELECT lower(hex(randomblob(16))),NEW.user_id,-min(balance,NEW.reversed-OLD.reversed),'reversal','reversal:'||NEW.id||':'||NEW.reversed FROM bw_wallets WHERE user_id=NEW.user_id;
 UPDATE bw_user_badges SET status='suspended' WHERE user_id=NEW.user_id;
 UPDATE bw_badges SET dirty=1,revision=revision+1 WHERE id IN(SELECT badge FROM bw_user_badges WHERE user_id=NEW.user_id);
 UPDATE bw_topups SET state='review' WHERE id=NEW.topup_id;
END;
UPDATE bw_badges SET level=0,owner=NULL,dirty=1,revision=revision+1 WHERE id='funded';
UPDATE bw_badges SET dirty=1,revision=revision+1 WHERE id='flex';
-- Abort rather than reset deferred bookkeeping if a reference was not retained.
CREATE TABLE bw_season_migration_check(violations INTEGER CHECK(violations=0));
INSERT INTO bw_season_migration_check SELECT count(*) FROM pragma_foreign_key_check;
DROP TABLE bw_season_migration_check;
PRAGMA defer_foreign_keys=OFF;
