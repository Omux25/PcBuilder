CREATE TABLE IF NOT EXISTS traffic_logs (
    id SERIAL PRIMARY KEY,
    ip TEXT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    user_agent TEXT,
    status_code INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traffic_logs_created_at ON traffic_logs (created_at DESC);
