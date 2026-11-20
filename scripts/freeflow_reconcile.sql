-- Reconciliacao conservadora: sem verificar coordenadas, sentido ou cobranca.
-- Execute somente apos carregar ff_observations; reexecutavel sem duplicar.
INSERT OR IGNORE INTO ff_matches(observation_a,observation_b,match_rule,review_status,notes)
SELECT a.id,b.id,
  CASE WHEN b.unit_count > 1 OR (b.km_start IS NOT NULL AND b.km_end IS NOT NULL AND ABS(b.km_start-b.km_end)>0.001)
    THEN 'same_road_uf_km_aggregated'
    ELSE 'same_road_uf_km' END,
  'candidate',
  'Apenas correspondência quilométrica. Sem validação de coordenadas, direção ou cobrança.'
FROM ff_observations a
JOIN ff_observations b ON b.source_id='sem_parar'
  AND a.road=b.road
  AND (a.state=b.state OR a.state IS NULL OR b.state IS NULL)
WHERE a.source_id='antt_map' AND a.km_start IS NOT NULL
  AND ((b.km_start IS NOT NULL AND ABS(a.km_start-b.km_start)<=0.015)
    OR (b.km_end IS NOT NULL AND ABS(a.km_start-b.km_end)<=0.015));

INSERT OR IGNORE INTO ff_review_queue(observation_id,reason)
SELECT id,'coordinates_unverified' FROM ff_observations WHERE coordinate_quality<>'verified';
INSERT OR IGNORE INTO ff_review_queue(observation_id,reason)
SELECT id,'no_unique_road_km' FROM ff_observations WHERE road IS NULL OR km_start IS NULL;
INSERT OR IGNORE INTO ff_review_queue(observation_id,reason)
SELECT id,'aggregated_units' FROM ff_observations WHERE unit_count>1;
INSERT OR IGNORE INTO ff_review_queue(observation_id,reason)
SELECT id,'operating_status_unknown' FROM ff_observations WHERE status_normalized='unknown';
