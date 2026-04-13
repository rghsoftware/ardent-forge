-- Remove notes and note_tags from logged_sets.
-- Set-level notes are no longer exposed in the UI.
-- Activity-level and session-level notes are unchanged.

drop index if exists idx_logged_sets_note_tags;

alter table logged_sets
  drop column if exists note_tags;

alter table logged_sets
  drop column if exists notes;
