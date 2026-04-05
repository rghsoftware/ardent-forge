-- =============================================================================
-- Migration: Optimize Direct Conversation Uniqueness (CH-2)
-- Description: Replaces the O(N) trigger scan in enforce_direct_conversation_uniqueness()
--              with a materialized lookup table (direct_conversation_pairs) that uses a
--              UNIQUE index on pair_key. The trigger now does a single INSERT and lets
--              the unique constraint catch duplicates, reducing enforcement from O(N) to O(1).
--              Also adds cleanup logic for when a participant leaves (left_at set).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Materialized lookup table for direct conversation pair keys
-- ---------------------------------------------------------------------------
create table if not exists direct_conversation_pairs (
    conversation_id uuid primary key references conversations(id) on delete cascade,
    pair_key        text not null
);

comment on table direct_conversation_pairs is 'Lookup table for CH-2 uniqueness enforcement. Stores canonical user-pair keys for direct conversations.';

-- Unique index on pair_key enforces that no two direct conversations share the same user pair
create unique index if not exists idx_direct_conversation_pairs_pair_key
    on direct_conversation_pairs(pair_key);

-- ---------------------------------------------------------------------------
-- 2. Backfill from existing direct conversations
--    Uses ON CONFLICT to remain idempotent if run multiple times.
-- ---------------------------------------------------------------------------
insert into direct_conversation_pairs (conversation_id, pair_key)
select c.id, direct_conversation_pair(c.id)
from conversations c
where c.type = 'direct'
  and direct_conversation_pair(c.id) is not null
on conflict (conversation_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Replace the trigger function with an optimized version
--    Instead of scanning all direct conversations, INSERT into the lookup
--    table and let the unique index reject duplicates.
-- ---------------------------------------------------------------------------
create or replace function enforce_direct_conversation_uniqueness()
returns trigger
language plpgsql as $$
declare
    conv_type text;
    pair      text;
begin
    -- Only enforce for direct conversations
    select type into conv_type
    from conversations
    where id = new.conversation_id;

    if conv_type != 'direct' then
        return new;
    end if;

    -- Compute the canonical pair for this conversation
    pair := direct_conversation_pair(new.conversation_id);

    if pair is not null then
        -- Attempt to register the pair; the unique index on pair_key will
        -- raise a unique_violation if another direct conversation already
        -- has this same user pair.
        begin
            insert into direct_conversation_pairs (conversation_id, pair_key)
            values (new.conversation_id, pair)
            on conflict (conversation_id) do update set pair_key = excluded.pair_key;
        exception
            when unique_violation then
                raise exception 'A direct conversation between these two users already exists (CH-2)'
                    using errcode = 'unique_violation';
        end;
    end if;

    return new;
end;
$$;

comment on function enforce_direct_conversation_uniqueness() is 'BEFORE INSERT trigger on conversation_participants enforcing CH-2 via direct_conversation_pairs lookup table.';

-- ---------------------------------------------------------------------------
-- 4. Cleanup trigger: when a participant leaves a direct conversation
--    (left_at is set from NULL), remove the pair entry so the pair can be
--    reused in a new conversation.
-- ---------------------------------------------------------------------------
create or replace function cleanup_direct_conversation_pair()
returns trigger
language plpgsql as $$
declare
    conv_type text;
begin
    -- Only act when left_at transitions from NULL to non-NULL
    if old.left_at is not null or new.left_at is null then
        return new;
    end if;

    select type into conv_type
    from conversations
    where id = new.conversation_id;

    if conv_type = 'direct' then
        delete from direct_conversation_pairs
        where conversation_id = new.conversation_id;
    end if;

    return new;
end;
$$;

comment on function cleanup_direct_conversation_pair() is 'AFTER UPDATE trigger that removes the pair entry when a participant leaves a direct conversation, allowing the pair to be reused.';

-- Drop existing cleanup trigger if present (idempotent)
drop trigger if exists cleanup_direct_conversation_pair_trigger on conversation_participants;

create trigger cleanup_direct_conversation_pair_trigger
    after update on conversation_participants
    for each row execute function cleanup_direct_conversation_pair();
