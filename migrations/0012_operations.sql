-- Operational records are separate from financial records. Resolving a case
-- never changes wallets, payments, reservations or badge eligibility.
ALTER TABLE bw_operations ADD COLUMN state TEXT NOT NULL DEFAULT 'open' CHECK(state IN('open','acknowledged','resolved'));
ALTER TABLE bw_operations ADD COLUMN occurrences INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bw_operations ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0;
CREATE INDEX bw_operations_state ON bw_operations(state,last_seen);
CREATE TABLE bw_operation_events(
 id TEXT PRIMARY KEY,operation_id TEXT NOT NULL REFERENCES bw_operations(id),
 state TEXT NOT NULL CHECK(state IN('open','acknowledged','resolved')),
 actor TEXT NOT NULL CHECK(length(actor) BETWEEN 2 AND 120),
 note TEXT NOT NULL CHECK(length(note) BETWEEN 8 AND 1000),
 occurrence INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX bw_operation_event_case ON bw_operation_events(operation_id,created_at);
CREATE TRIGGER bw_operation_event_validate BEFORE INSERT ON bw_operation_events BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM bw_operations WHERE id=NEW.operation_id AND occurrences=NEW.occurrence) THEN RAISE(ABORT,'operation_changed') END;
END;
CREATE TRIGGER bw_operation_event_apply AFTER INSERT ON bw_operation_events BEGIN
 UPDATE bw_operations SET state=NEW.state WHERE id=NEW.operation_id;
END;
CREATE TRIGGER bw_operation_recur AFTER UPDATE OF occurrences ON bw_operations WHEN OLD.state='resolved' BEGIN
 INSERT INTO bw_operation_events(id,operation_id,state,actor,note,occurrence)
 VALUES(lower(hex(randomblob(16))),NEW.id,'open','system','Condition observed again after resolution',NEW.occurrences);
END;
CREATE TRIGGER bw_operation_event_no_update BEFORE UPDATE ON bw_operation_events BEGIN SELECT RAISE(ABORT,'immutable_operation_event'); END;
CREATE TRIGGER bw_operation_event_no_delete BEFORE DELETE ON bw_operation_events BEGIN SELECT RAISE(ABORT,'immutable_operation_event'); END;
CREATE TABLE bw_runtime(key TEXT PRIMARY KEY,value TEXT NOT NULL CHECK(json_valid(value)),updated_at INTEGER NOT NULL);
CREATE TABLE bw_alerts(key TEXT PRIMARY KEY,fingerprint TEXT NOT NULL DEFAULT '[]',last_sent INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,lease_token TEXT);
CREATE INDEX bw_refund_requests_state ON bw_refund_requests(state,created_at);
CREATE INDEX bw_wallets_review ON bw_wallets(frozen,debt);
