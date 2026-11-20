-- BoaEstrada / Cloudflare D1. Staging auditável: não marca rotas como livres de Free Flow.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS ff_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  authority TEXT NOT NULL CHECK(authority IN ('official','industry','other')),
  license TEXT,
  last_checked_at TEXT
);
CREATE TABLE IF NOT EXISTS ff_observations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES ff_sources(id),
  source_row_key TEXT NOT NULL,
  road TEXT,
  state TEXT,
  municipality TEXT,
  km_text TEXT,
  km_start REAL,
  km_end REAL,
  direction TEXT,
  concessionaire TEXT,
  unit_type TEXT NOT NULL CHECK(unit_type IN ('gantry','charging_point','unknown')),
  unit_count INTEGER NOT NULL DEFAULT 1 CHECK(unit_count >= 0),
  status_reported TEXT,
  status_normalized TEXT NOT NULL DEFAULT 'unknown'
    CHECK(status_normalized IN ('active','planned','installed','suspended','retired','monitoring','unknown')),
  latitude REAL CHECK(latitude BETWEEN -90 AND 90),
  longitude REAL CHECK(longitude BETWEEN -180 AND 180),
  coordinate_quality TEXT NOT NULL DEFAULT 'missing'
    CHECK(coordinate_quality IN ('verified','approximate','missing')),
  source_url TEXT,
  source_updated_at TEXT,
  retrieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_json TEXT NOT NULL,
  UNIQUE(source_id,source_row_key)
);
CREATE INDEX IF NOT EXISTS ix_ff_observations_road_km ON ff_observations(road,state,km_start);
CREATE INDEX IF NOT EXISTS ix_ff_observations_status ON ff_observations(status_normalized);
CREATE TABLE IF NOT EXISTS ff_matches (
  observation_a TEXT NOT NULL REFERENCES ff_observations(id),
  observation_b TEXT NOT NULL REFERENCES ff_observations(id),
  match_rule TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'candidate' CHECK(review_status IN ('candidate','confirmed','rejected')),
  notes TEXT,
  PRIMARY KEY(observation_a,observation_b)
);
CREATE TABLE IF NOT EXISTS ff_review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  observation_id TEXT NOT NULL REFERENCES ff_observations(id),
  reason TEXT NOT NULL,
  detail TEXT,
  reviewed_at TEXT,
  UNIQUE(observation_id,reason)
);
CREATE TABLE IF NOT EXISTS ff_import_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  source_id TEXT REFERENCES ff_sources(id),
  rows_imported INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 0,
  error_text TEXT
);
-- Pórticos canônicos e arestas tarifadas só após verificação geográfica.