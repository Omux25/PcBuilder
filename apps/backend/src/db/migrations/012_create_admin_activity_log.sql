-- Migration 012: Create admin_activity_log table
-- Audit trail for all admin write actions.
-- Used by the dashboard "Recent Activity" feed.

CREATE TABLE IF NOT EXISTS admin_activity_log (
    id           SERIAL PRIMARY KEY,
    admin_id     INTEGER      NOT NULL
                     REFERENCES admins (id) ON DELETE CASCADE,
    action       VARCHAR(100) NOT NULL,   -- e.g. component_created, retailer_deactivated
    entity_type  VARCHAR(50),             -- component, retailer, preset_build, scraper_mapping
    entity_id    INTEGER,                 -- ID of the affected row
    details      JSONB,                   -- optional extra context (e.g. changed fields)
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Dashboard query: latest N entries ordered by time
CREATE INDEX IF NOT EXISTS idx_admin_activity_created
    ON admin_activity_log (created_at DESC);

-- Filter by admin
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin
    ON admin_activity_log (admin_id);
