-- Add last_assigned_at to track recently used session templates in the picker
ALTER TABLE session_templates ADD COLUMN last_assigned_at INTEGER;
