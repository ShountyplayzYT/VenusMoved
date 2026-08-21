-- Run this once against your Neon database.
-- Your existing "shipmentsdb" table is untouched; this only adds the
-- tables that used to live in local JSON files (users.json,
-- geocode_cache.json, distance_cache.json) so state survives across
-- serverless invocations and deploys.

CREATE TABLE IF NOT EXISTS app_users (
    email         TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    salt          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS geocode_cache (
    city_name  TEXT PRIMARY KEY,
    lon        DOUBLE PRECISION,
    lat        DOUBLE PRECISION,
    state      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS distance_cache (
    route_key  TEXT PRIMARY KEY,
    km         DOUBLE PRECISION,
    hours      DOUBLE PRECISION,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adds the "Company" column to the existing shipmentsdb table (the customer
-- name each load belongs to, taken from the report's company section
-- headers) and makes sure "Load #" is unique so the /api/import endpoint
-- can detect which loads are already in Neon. Safe to re-run.

ALTER TABLE shipmentsdb ADD COLUMN IF NOT EXISTS "Company" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'shipmentsdb_load_unique'
    ) THEN
        ALTER TABLE shipmentsdb
        ADD CONSTRAINT shipmentsdb_load_unique UNIQUE ("Load #");
    END IF;
END $$;