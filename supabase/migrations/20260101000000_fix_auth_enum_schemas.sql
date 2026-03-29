-- ---------------------------------------------------------------------------
-- Compatibility shim for supabase/postgres:15.8.1.060:
--
-- 1. factor_type / factor_status / aal_level enums are initialised in the
--    PUBLIC schema by the postgres image, but supabase/gotrue v2.x expects
--    them in the AUTH schema.  This migration moves them before GoTrue runs.
--
-- 2. supabase/realtime v2.x requires a _realtime schema (not the public
--    "realtime" schema created by the postgres image).
-- ---------------------------------------------------------------------------

-- Create _realtime schema required by supabase/realtime
CREATE SCHEMA IF NOT EXISTS _realtime;
GRANT ALL ON SCHEMA _realtime TO postgres;

DO $$
BEGIN
  -- -------------------------------------------------------------------------
  -- 1. Create auth-schema enum types if they don't already exist
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'auth' AND t.typname = 'factor_type' AND t.typtype = 'e'
  ) THEN
    CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'auth' AND t.typname = 'factor_status' AND t.typtype = 'e'
  ) THEN
    CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'auth' AND t.typname = 'aal_level' AND t.typtype = 'e'
  ) THEN
    CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. Migrate auth.mfa_factors columns to auth-schema types if they still
  --    reference the public-schema versions
  -- -------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'mfa_factors'
      AND column_name = 'factor_type' AND udt_schema = 'public'
  ) THEN
    ALTER TABLE auth.mfa_factors ADD COLUMN factor_type_new auth.factor_type;
    UPDATE auth.mfa_factors SET factor_type_new = factor_type::text::auth.factor_type;
    ALTER TABLE auth.mfa_factors DROP COLUMN factor_type;
    ALTER TABLE auth.mfa_factors RENAME COLUMN factor_type_new TO factor_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'mfa_factors'
      AND column_name = 'status' AND udt_schema = 'public'
  ) THEN
    ALTER TABLE auth.mfa_factors ADD COLUMN status_new auth.factor_status;
    UPDATE auth.mfa_factors SET status_new = status::text::auth.factor_status;
    ALTER TABLE auth.mfa_factors DROP COLUMN status;
    ALTER TABLE auth.mfa_factors RENAME COLUMN status_new TO status;
  END IF;

  -- -------------------------------------------------------------------------
  -- 3. Migrate auth.sessions.aal column if it references public.aal_level
  -- -------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'sessions'
      AND column_name = 'aal' AND udt_schema = 'public'
  ) THEN
    ALTER TABLE auth.sessions ADD COLUMN aal_new auth.aal_level;
    UPDATE auth.sessions SET aal_new = aal::text::auth.aal_level;
    ALTER TABLE auth.sessions DROP COLUMN aal;
    ALTER TABLE auth.sessions RENAME COLUMN aal_new TO aal;
  END IF;
END
$$;
