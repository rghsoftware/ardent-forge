-- Fix event_metadata column comments to use clean plaintext field notation
-- instead of ambiguous mixed JSON/type-descriptor syntax.
-- Resolves: GitHub issue #32

comment on column session_templates.event_metadata is
$$JSONB event metadata for EVENT session templates. NULL for non-EVENT categories.

Fields:
  location    text   -- event venue or location name
  eventDate   text   -- ISO-8601 date string (e.g. "2026-06-15")
  distance    jsonb  -- { value: number, unit: "mi" | "km" }
  cutoffTime  jsonb  -- { seconds: number }
  elevation   jsonb  -- { value: number, unit: "ft" | "m" }
$$;

comment on column workout_logs.event_metadata is
$$JSONB event metadata snapshot captured when logging an EVENT session.
Same shape as session_templates.event_metadata. NULL for non-EVENT logs.
$$;
