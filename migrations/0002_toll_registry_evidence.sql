-- BoaEstrada: segunda migracao, evidencia de pracas (NUNCA assume Free Flow)
-- Aplica-se ao D1 de staging isolado. Nenhum binding em producao.
CREATE TABLE IF NOT EXISTS toll_registry_observations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES ff_sources(id),
  source_row_key TEXT NOT NULL,
  name TEXT,
  road TEXT,
  state TEXT,
  municipality TEXT,
  kilometer REAL,
  kilometer_raw TEXT,
  direction TEXT,
  concessionaire TEXT,
  status_reported TEXT,
  classification TEXT NOT NULL DEFAULT 'unclassified'
    CHECK(classification IN ('unclassified','conventional_claimed','free_flow_candidate')),
  latitude REAL CHECK(latitude BETWEEN -90 AND 90),
  longitude REAL CHECK(longitude BETWEEN -180 AND 180),
  coordinate_quality TEXT NOT NULL DEFAULT 'missing'
    CHECK(coordinate_quality IN ('reported','missing')),
  source_url TEXT,
  source_updated_at TEXT,
  retrieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_json TEXT NOT NULL,
  UNIQUE(source_id,source_row_key)
);
CREATE INDEX IF NOT EXISTS ix_toll_registry_road_km
ON toll_registry_observations(road,state,kilometer);
CREATE INDEX IF NOT EXISTS ix_toll_registry_source
ON toll_registry_observations(source_id,classification);
CREATE TABLE IF NOT EXISTS ff_toll_overlap_flags (
  ff_observation_id TEXT NOT NULL REFERENCES ff_observations(id),
  toll_observation_id TEXT NOT NULL REFERENCES toll_registry_observations(id),
  rule TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'candidate'
    CHECK(review_status IN ('candidate','confirmed','rejected')),
  notes TEXT,
  PRIMARY KEY(ff_observation_id,toll_observation_id)
);
-- Importantes: registros de ANTT praca-de-pedagio nao sao Free Flow por definicao.
-- Coordenadas declaradas sao evidencia reportada, nao verificacao geometrica.
