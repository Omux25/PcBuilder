-- Migration 049: Create shared_builds table for PC configurations sharing
CREATE TABLE IF NOT EXISTS shared_builds (
    id          VARCHAR(10) PRIMARY KEY, -- unique random code (e.g. 'x7b2f9')
    config_json JSONB NOT NULL,          -- JSON mapping slotKey to component ID
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
