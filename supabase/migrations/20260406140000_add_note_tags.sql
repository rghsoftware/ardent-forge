-- Feature 020: Workout Notes -- add note_tags arrays to log tables
-- Adds a note_tags text[] column to workout_logs, logged_activities, and
-- logged_sets for tagging free-text notes (e.g. "FORM BREAKDOWN", "PR ATTEMPT").
-- Existing rows default to an empty array. RLS is inherited from the parent
-- row policies already defined on these tables; no new policies are required.
--
-- Constraints:
--   * Array length capped at 16 tags per row (CHECK constraint).
--   * Per-element length (32 chars) and format normalization (uppercase,
--     whitespace collapse) are enforced at the application layer via Zod.
--     See src/domain/types/workout-note.ts.
--
-- Indexing: GIN indices on each note_tags column to support future
-- tag-filtered queries (tag containment / overlap).

alter table workout_logs
  add column note_tags text[] not null default '{}';

alter table workout_logs
  add constraint workout_logs_note_tags_length_check
  check (array_length(note_tags, 1) is null or array_length(note_tags, 1) <= 16);

alter table logged_activities
  add column note_tags text[] not null default '{}';

alter table logged_activities
  add constraint logged_activities_note_tags_length_check
  check (array_length(note_tags, 1) is null or array_length(note_tags, 1) <= 16);

alter table logged_sets
  add column note_tags text[] not null default '{}';

alter table logged_sets
  add constraint logged_sets_note_tags_length_check
  check (array_length(note_tags, 1) is null or array_length(note_tags, 1) <= 16);

create index idx_workout_logs_note_tags
  on workout_logs using gin (note_tags);

create index idx_logged_activities_note_tags
  on logged_activities using gin (note_tags);

create index idx_logged_sets_note_tags
  on logged_sets using gin (note_tags);

comment on column workout_logs.note_tags is 'Curated + user-defined tags associated with overall_notes. Per-element length (32 chars) enforced at the application layer (Zod).';
comment on column logged_activities.note_tags is 'Curated + user-defined tags associated with the activity notes. Per-element length (32 chars) enforced at the application layer (Zod).';
comment on column logged_sets.note_tags is 'Curated + user-defined tags associated with the set notes. Per-element length (32 chars) enforced at the application layer (Zod).';
