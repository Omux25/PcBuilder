CREATE TABLE IF NOT EXISTS local_workers (
    id VARCHAR(50) PRIMARY KEY,
    heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_job INTEGER NULL REFERENCES retailers(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'idle',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a default worker row for the home PC
INSERT INTO local_workers (id, heartbeat_at, status) 
VALUES ('home-pc', NOW() - INTERVAL '1 hour', 'idle')
ON CONFLICT (id) DO NOTHING;
