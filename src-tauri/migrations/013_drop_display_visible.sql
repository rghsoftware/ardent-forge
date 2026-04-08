-- 013_drop_display_visible.sql
-- F018 (Gym-Scoped Displays): the legacy per-user opt-out flag is replaced by
-- per-workout gym selection. The Tauri SQLite cache mirrors the Postgres
-- migration that removes user_profiles.display_visible (see Tech.md D14).
--
-- SQLite supports ALTER TABLE ... DROP COLUMN since 3.35.0 (March 2021).
-- sqlx 0.8.x bundles a SQLite well past that version, so a single statement
-- is sufficient.

ALTER TABLE user_profiles DROP COLUMN IF EXISTS display_visible;
