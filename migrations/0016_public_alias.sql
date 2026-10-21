-- One public identity per account. Provider names and immutable action receipts stay intact.
ALTER TABLE bw_users ADD COLUMN public_alias TEXT COLLATE NOCASE
 CHECK(public_alias IS NULL OR (length(public_alias) BETWEEN 2 AND 24 AND public_alias NOT GLOB '*[^A-Za-z0-9_]*'));
ALTER TABLE bw_users ADD COLUMN alias_changed_at INTEGER
 CHECK(alias_changed_at IS NULL OR (typeof(alias_changed_at)='integer' AND alias_changed_at>0));

-- Preserve a valid legacy handle where possible. Resolve collisions deterministically;
-- generated migration names are in a reserved namespace and may be chosen anew immediately.
WITH legacy AS (
 SELECT user_id,owner AS alias,updated_at AS at FROM bw_user_badges
 UNION ALL SELECT user_id,alias,last_at FROM bw_contributors
), latest AS (
 SELECT *,row_number() OVER(PARTITION BY user_id ORDER BY at DESC,alias COLLATE BINARY) AS n FROM legacy
), candidates AS (
 SELECT user_id,alias,row_number() OVER(PARTITION BY lower(alias) ORDER BY user_id) AS priority FROM latest
 WHERE n=1 AND length(alias) BETWEEN 2 AND 24 AND alias NOT GLOB '*[^A-Za-z0-9_]*'
 AND lower(alias) NOT GLOB 'bw_user_*'
)
UPDATE bw_users SET public_alias=(SELECT alias FROM candidates WHERE user_id=bw_users.id AND priority=1)
 WHERE id IN(SELECT user_id FROM candidates WHERE priority=1);
UPDATE bw_users SET public_alias='bw_user_'||rowid
 WHERE public_alias IS NULL AND (id IN(SELECT user_id FROM bw_user_badges) OR id IN(SELECT user_id FROM bw_contributors));
CREATE UNIQUE INDEX bw_users_public_alias ON bw_users(public_alias COLLATE NOCASE) WHERE public_alias IS NOT NULL;

CREATE TRIGGER bw_alias_cooldown BEFORE UPDATE OF public_alias ON bw_users
 WHEN NEW.public_alias COLLATE BINARY IS NOT OLD.public_alias COLLATE BINARY
 BEGIN
  SELECT CASE WHEN OLD.alias_changed_at IS NOT NULL AND OLD.alias_changed_at>CAST(strftime('%s','now') AS INTEGER)-1209600
   THEN RAISE(ABORT,'alias_locked') END;
  SELECT CASE WHEN NEW.public_alias IS NULL OR NEW.alias_changed_at IS NOT CAST(strftime('%s','now') AS INTEGER)
   THEN RAISE(ABORT,'invalid_alias_change') END;
 END;
CREATE TRIGGER bw_alias_publication AFTER UPDATE OF public_alias ON bw_users
 WHEN NEW.public_alias COLLATE BINARY IS NOT OLD.public_alias COLLATE BINARY
 BEGIN
  UPDATE bw_badges SET dirty=1,revision=revision+1
   WHERE id IN(SELECT badge FROM bw_user_badges WHERE user_id=NEW.id)
   OR (id='quality' AND EXISTS(SELECT 1 FROM bw_contributors WHERE user_id=NEW.id));
 END;
-- An alias edit racing a purchase cannot publish the previous name or another user's handle.
CREATE TRIGGER bw_action_public_alias BEFORE INSERT ON bw_actions
 WHEN (SELECT public_alias FROM bw_users WHERE id=NEW.user_id) IS NOT NULL
 AND NEW.owner COLLATE BINARY IS NOT (SELECT public_alias FROM bw_users WHERE id=NEW.user_id) COLLATE BINARY
 BEGIN SELECT RAISE(ABORT,'alias_changed'); END;
UPDATE bw_badges SET dirty=1,revision=revision+1;
