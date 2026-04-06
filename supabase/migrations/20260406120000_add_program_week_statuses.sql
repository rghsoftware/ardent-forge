-- program_week_statuses
-- Stores skip/done labels when users jump forward in their program (time travel).

create table program_week_statuses (
    id              uuid        primary key default gen_random_uuid(),
    activation_id   uuid        not null references program_activations(id) on delete cascade,
    block_ordinal   integer     not null,
    week_number     integer     not null,
    status          text        not null check (status in ('done', 'skipped')),
    created_at      timestamptz not null default now(),

    unique (activation_id, block_ordinal, week_number)
);

comment on table program_week_statuses is 'Records per-week status (done/skipped) when a user jumps forward in their program.';
comment on column program_week_statuses.activation_id is 'The program activation this status belongs to.';
comment on column program_week_statuses.block_ordinal is 'Ordinal of the block within the program.';
comment on column program_week_statuses.week_number is 'Week number within the block.';
comment on column program_week_statuses.status is 'Week status: done or skipped.';
comment on column program_week_statuses.created_at is 'Row creation timestamp.';

-- Index for looking up statuses by activation
create index idx_program_week_statuses_activation on program_week_statuses(activation_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table program_week_statuses enable row level security;

create policy "program_week_statuses_select"
    on program_week_statuses for select
    using (exists (
        select 1 from program_activations
        where id = program_week_statuses.activation_id
          and user_id = auth.uid()
    ));

create policy "program_week_statuses_insert"
    on program_week_statuses for insert
    with check (exists (
        select 1 from program_activations
        where id = program_week_statuses.activation_id
          and user_id = auth.uid()
    ));

create policy "program_week_statuses_update"
    on program_week_statuses for update
    using (exists (
        select 1 from program_activations
        where id = program_week_statuses.activation_id
          and user_id = auth.uid()
    ));

create policy "program_week_statuses_delete"
    on program_week_statuses for delete
    using (exists (
        select 1 from program_activations
        where id = program_week_statuses.activation_id
          and user_id = auth.uid()
    ));
