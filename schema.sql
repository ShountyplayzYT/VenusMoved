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
