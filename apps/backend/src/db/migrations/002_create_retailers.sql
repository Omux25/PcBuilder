-- Migration 002: Create retailers table

CREATE TABLE IF NOT EXISTS retailers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    base_url    VARCHAR(255) NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE
);
