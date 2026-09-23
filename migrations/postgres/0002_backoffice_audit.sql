BEGIN;

CREATE TABLE IF NOT EXISTS backoffice_audit (
    id BIGSERIAL PRIMARY KEY,
    ctime TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_uid BIGINT NOT NULL,
    target_uid BIGINT NOT NULL,
    cid BIGINT NOT NULL DEFAULT 0,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    ledger_id BIGINT NOT NULL DEFAULT 0,
    meta TEXT
);

CREATE INDEX IF NOT EXISTS idx_backoffice_audit_target_uid ON backoffice_audit(target_uid);
CREATE INDEX IF NOT EXISTS idx_backoffice_audit_actor_uid ON backoffice_audit(actor_uid);
CREATE INDEX IF NOT EXISTS idx_backoffice_audit_cid ON backoffice_audit(cid);

INSERT INTO schema_migrations(version)
VALUES ('0002_backoffice_audit')
ON CONFLICT (version) DO NOTHING;

COMMIT;
