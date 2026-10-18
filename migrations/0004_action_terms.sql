-- Preserve the terms version for credit spending as well as top-ups.
ALTER TABLE bw_actions ADD COLUMN terms_version TEXT NOT NULL DEFAULT '2026-10-18';
-- The visible leader and quote must agree after an account is suspended.
CREATE TRIGGER bw_recompute_leader AFTER UPDATE OF status ON bw_user_badges
WHEN NEW.badge IN('flex','bait','funded') AND NEW.status<>OLD.status BEGIN
 UPDATE bw_badges SET
  level=coalesce((SELECT max(level) FROM bw_user_badges WHERE badge=NEW.badge AND status='active'),0),
  owner=(SELECT owner FROM bw_user_badges WHERE badge=NEW.badge AND status='active' ORDER BY level DESC,updated_at,id LIMIT 1),
  dirty=1,revision=revision+1 WHERE id=NEW.badge;
END;
