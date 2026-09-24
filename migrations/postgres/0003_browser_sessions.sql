BEGIN;

CREATE TABLE IF NOT EXISTS browser_session (
    id BIGSERIAL PRIMARY KEY,
    uid BIGINT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    csrf_hash CHAR(64) NOT NULL,
    ctime TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    FOREIGN KEY (uid) REFERENCES "user"(uid) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_browser_session_uid ON browser_session(uid);
CREATE INDEX IF NOT EXISTS idx_browser_session_expires_at ON browser_session(expires_at);
CREATE INDEX IF NOT EXISTS idx_browser_session_revoked_at ON browser_session(revoked_at);

INSERT INTO schema_migrations(version)
VALUES ('0003_browser_sessions')
ON CONFLICT (version) DO NOTHING;

COMMIT;
