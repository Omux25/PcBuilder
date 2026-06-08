-- Migration 048: Fix traffic_logs schema mismatches
DO $$
BEGIN
    -- Rename ip_address to ip if ip_address exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'traffic_logs' AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE traffic_logs RENAME COLUMN ip_address TO ip;
    END IF;

    -- Add response_time_ms if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'traffic_logs' AND column_name = 'response_time_ms'
    ) THEN
        ALTER TABLE traffic_logs ADD COLUMN response_time_ms INTEGER;
    END IF;
END $$;
