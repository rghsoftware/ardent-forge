-- =============================================================================
-- Migration: Add display_visible to user_profiles
-- Description: Adds a boolean column controlling whether a user's active
--              workout appears on the remote gym display. Defaults to visible.
--              Existing RLS policies cover all columns, so no policy changes.
-- =============================================================================

alter table user_profiles
    add column display_visible boolean not null default true;

comment on column user_profiles.display_visible is
    'Whether the user''s active workout appears on the remote gym display. Default: visible.';
