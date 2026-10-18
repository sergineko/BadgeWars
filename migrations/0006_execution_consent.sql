CREATE TABLE bw_terms_documents(version TEXT NOT NULL,locale TEXT NOT NULL,document TEXT NOT NULL,PRIMARY KEY(version,locale));
CREATE TRIGGER bw_terms_immutable_update BEFORE UPDATE ON bw_terms_documents BEGIN SELECT RAISE(ABORT,'immutable_terms'); END;
CREATE TRIGGER bw_terms_immutable_delete BEFORE DELETE ON bw_terms_documents BEGIN SELECT RAISE(ABORT,'immutable_terms'); END;
ALTER TABLE bw_actions ADD COLUMN terms_locale TEXT NOT NULL DEFAULT 'es';
ALTER TABLE bw_actions ADD COLUMN execution_requested INTEGER NOT NULL DEFAULT 0 CHECK(execution_requested IN(0,1));
ALTER TABLE bw_actions ADD COLUMN withdrawal_acknowledged INTEGER NOT NULL DEFAULT 0 CHECK(withdrawal_acknowledged IN(0,1));
CREATE TRIGGER bw_action_consent BEFORE INSERT ON bw_actions BEGIN
 SELECT CASE WHEN NEW.execution_requested<>1 OR NEW.withdrawal_acknowledged<>1 OR NOT EXISTS(SELECT 1 FROM bw_terms_documents WHERE version=NEW.terms_version AND locale=NEW.terms_locale) THEN RAISE(ABORT,'invalid_consent') END;
END;
