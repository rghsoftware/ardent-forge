-- =============================================================================
-- Migration: Add Exercise Alias Search
-- Description: GIN indices for JSONB exercise search and a helper function
--              that searches exercises by name or alias.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- GIN index on exercises.aliases for containment queries on the JSONB array.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_exercises_aliases_gin ON exercises USING gin (aliases);

-- ---------------------------------------------------------------------------
-- GIN index on exercises.muscle_groups for containment queries on the JSONB
-- object (e.g. filtering by primary muscle group).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_groups_gin ON exercises USING gin (muscle_groups);

-- ---------------------------------------------------------------------------
-- search_exercises(query_text text)
--
-- Returns exercise rows where:
--   1. The name matches (case-insensitive substring), OR
--   2. Any element in the aliases JSONB array matches (case-insensitive substring).
--
-- Uses jsonb_array_elements_text() to expand the aliases array for matching.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_exercises(query_text text)
RETURNS SETOF exercises
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT e.*
  FROM exercises e
  LEFT JOIN LATERAL jsonb_array_elements_text(e.aliases) AS alias ON true
  WHERE e.name ILIKE '%' || query_text || '%'
     OR alias ILIKE '%' || query_text || '%';
$$;
