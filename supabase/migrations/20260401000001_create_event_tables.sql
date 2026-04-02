-- =============================================================================
-- Migration: Create Event Tables
-- Description: Extends session templates and workout logs to support EVENT
--              category sessions with packing lists (event_items) instead of
--              exercises and sets.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Expand session_templates.category to include 'EVENT'
--    The original inline CHECK is auto-named session_templates_category_check.
-- ---------------------------------------------------------------------------
alter table session_templates
    drop constraint session_templates_category_check;

alter table session_templates
    add constraint session_templates_category_check
    check (category in ('STRENGTH', 'CONDITIONING', 'SE', 'MIXED', 'EVENT'));

-- ---------------------------------------------------------------------------
-- 2. Expand scheduled_sessions.session_type to include 'EVENT'
--    The original inline CHECK is auto-named scheduled_sessions_session_type_check.
-- ---------------------------------------------------------------------------
alter table scheduled_sessions
    drop constraint scheduled_sessions_session_type_check;

alter table scheduled_sessions
    add constraint scheduled_sessions_session_type_check
    check (session_type in ('STRENGTH', 'CONDITIONING', 'SE', 'MIXED', 'EVENT'));

-- ---------------------------------------------------------------------------
-- 3. Add event_metadata JSONB column to session_templates
-- ---------------------------------------------------------------------------
alter table session_templates
    add column event_metadata jsonb;

comment on column session_templates.event_metadata is
    'JSONB event metadata for EVENT templates. Expected shape: '
    '{"location": string, "eventDate": ISO-8601, "distance": {"value": number, "unit": "mi"|"km"}, '
    '"cutoffTime": {"seconds": number}, "elevation": {"value": number, "unit": "ft"|"m"}}. '
    'NULL for non-EVENT categories.';

-- ---------------------------------------------------------------------------
-- 4. Add event_metadata JSONB column to workout_logs
-- ---------------------------------------------------------------------------
alter table workout_logs
    add column event_metadata jsonb;

comment on column workout_logs.event_metadata is
    'JSONB event metadata snapshot captured when logging an EVENT session. '
    'Same shape as session_templates.event_metadata. NULL for non-EVENT logs.';

-- ---------------------------------------------------------------------------
-- 5. event_items
--    Packing-list items for EVENT session templates and workout logs.
--    Each item belongs to exactly one parent (template XOR log) per EV-2.
-- ---------------------------------------------------------------------------
create table event_items (
    id                  uuid        primary key default gen_random_uuid(),
    session_template_id uuid        references session_templates(id) on delete cascade,
    workout_log_id      uuid        references workout_logs(id) on delete cascade,
    user_id             uuid        not null references auth.users on delete cascade,
    name                text        not null check (char_length(name) between 1 and 200),
    category            text,
    quantity            integer     not null default 1 check (quantity >= 1),
    is_packed           boolean     not null default false,
    sort_order          integer     not null check (sort_order >= 0),
    notes               text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),

    -- Invariant EV-2: exactly one parent FK must be set
    constraint event_items_parent_exclusivity check (
        (session_template_id is not null and workout_log_id is null)
        or (session_template_id is null and workout_log_id is not null)
    )
);

comment on table event_items is 'Packing-list items for EVENT sessions. Each item belongs to exactly one parent (template or log).';
comment on column event_items.session_template_id is 'Parent session template. Mutually exclusive with workout_log_id (EV-2).';
comment on column event_items.workout_log_id is 'Parent workout log. Mutually exclusive with session_template_id (EV-2).';
comment on column event_items.user_id is 'Owning user. Denormalized for direct RLS ownership checks.';
comment on column event_items.name is 'Item name. Must be 1-200 characters.';
comment on column event_items.category is 'Optional free-text grouping label (e.g. "Gear", "Nutrition", "Clothing").';
comment on column event_items.quantity is 'Number of this item to bring. Minimum 1.';
comment on column event_items.is_packed is 'Whether the item has been packed/checked off. Defaults to false.';
comment on column event_items.sort_order is 'Display order within the packing list. Zero-based.';
comment on column event_items.notes is 'Optional notes or details about this item.';

-- ---------------------------------------------------------------------------
-- 6. Indices
-- ---------------------------------------------------------------------------
create index idx_event_items_template
    on event_items(session_template_id)
    where session_template_id is not null;

create index idx_event_items_workout_log
    on event_items(workout_log_id)
    where workout_log_id is not null;

create index idx_event_items_user
    on event_items(user_id);

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
--    Direct user_id ownership check (user_id is denormalized on the table).
-- ---------------------------------------------------------------------------
alter table event_items enable row level security;

create policy "event_items_select"
    on event_items for select
    using (user_id = auth.uid());

create policy "event_items_insert"
    on event_items for insert
    with check (user_id = auth.uid());

create policy "event_items_update"
    on event_items for update
    using (user_id = auth.uid());

create policy "event_items_delete"
    on event_items for delete
    using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 8. Trigger: automatic updated_at
--    Reuses the shared update_updated_at_column() trigger function.
-- ---------------------------------------------------------------------------
create trigger set_event_items_updated_at before update on event_items
    for each row execute function update_updated_at_column();
