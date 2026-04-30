-- Migration 013: Create refresh_tokens table
-- Stores server-side refresh tokens for the admin session management system.
-- Access tokens (JWT, 15min) are stateless; refresh tokens (7-day) are stored here
-- so they can be explicitly invalidated on logout.

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    admin_id    INTEGER      NOT NULL
                    REFERENCES admins (id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,  -- random UUID or crypto token
    expires_at  TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Primary lookup: validate a token on refresh requests
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token
    ON refresh_tokens (token);

-- Cleanup job: find and delete expired tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires
    ON refresh_tokens (expires_at);

-- Find all sessions for a given admin (logout-all-devices)
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_admin
    ON refresh_tokens (admin_id);
