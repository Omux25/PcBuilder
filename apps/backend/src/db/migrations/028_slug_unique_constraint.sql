DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'components_slug_unique') THEN
        ALTER TABLE components ADD CONSTRAINT components_slug_unique UNIQUE (slug);
    END IF;
END
$$;
