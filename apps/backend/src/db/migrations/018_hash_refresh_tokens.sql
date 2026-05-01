-- Migration 017: Hash refresh tokens
-- Changes the refresh_tokens table to store hashed tokens instead of raw ones.
-- This follows security best practices (storing secrets like refresh tokens
-- with a one-way hash).

-- Since we are moving from raw to hashed tokens, we truncate existing tokens
-- to force all admins to re-login with the new secure format.
TRUNCATE TABLE refresh_tokens;

-- No structural changes needed as the 'token' column is already VARCHAR(255).
-- However, we add a comment to clarify the contents.
COMMENT ON COLUMN refresh_tokens.token IS 'SHA-256 hash of the raw refresh token hex string';
