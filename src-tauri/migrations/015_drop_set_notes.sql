-- Remove notes and note_tags from logged_sets.
-- Set-level notes are no longer exposed in the UI.
-- Activity-level and session-level notes are unchanged.

ALTER TABLE logged_sets DROP COLUMN note_tags;
ALTER TABLE logged_sets DROP COLUMN notes;
