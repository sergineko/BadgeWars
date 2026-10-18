-- Private credentials never enter public badge projections. Pending accounts have no wallet.
CREATE TABLE bw_email_accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN(0,1)),terms_version TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE bw_email_codes(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES bw_email_accounts(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN('verify','reset')),version INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX bw_email_codes_expiry ON bw_email_codes(expires);
CREATE INDEX bw_email_codes_account ON bw_email_codes(account_id,kind);
CREATE TRIGGER bw_email_activate AFTER UPDATE OF verified ON bw_email_accounts WHEN OLD.verified=0 AND NEW.verified=1 BEGIN
 INSERT INTO bw_users(id,provider,subject,name) VALUES(NEW.id,'email',NEW.id,'Collector_'||substr(replace(NEW.id,'-',''),1,8));
 DELETE FROM bw_email_codes WHERE account_id=NEW.id;
END;
CREATE TRIGGER bw_email_password_changed AFTER UPDATE OF password_hash ON bw_email_accounts WHEN NEW.password_hash<>OLD.password_hash BEGIN
 DELETE FROM bw_sessions WHERE user_id=NEW.id;
 DELETE FROM bw_email_codes WHERE account_id=NEW.id;
END;
