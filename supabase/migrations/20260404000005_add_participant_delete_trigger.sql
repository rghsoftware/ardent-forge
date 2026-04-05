-- =============================================================================
-- Migration: Add DELETE trigger for conversation_participants cleanup (P9-009)
-- Description: The cleanup_direct_conversation_pair trigger only fires on
--              UPDATE (left_at NULL -> non-NULL). If a participant row is
--              hard-deleted, the pair entry in direct_conversation_pairs
--              becomes orphaned, blocking future direct conversations between
--              those users. This migration adds an AFTER DELETE trigger to
--              handle that case.
-- =============================================================================

create or replace function cleanup_direct_conversation_pair_on_delete()
returns trigger
language plpgsql as $$
declare
    conv_type text;
begin
    select type into conv_type
    from conversations
    where id = old.conversation_id;

    if conv_type = 'direct' then
        delete from direct_conversation_pairs
        where conversation_id = old.conversation_id;
    end if;

    return null;
end;
$$;

comment on function cleanup_direct_conversation_pair_on_delete() is
    'AFTER DELETE trigger that removes the pair entry when a participant is hard-deleted from a direct conversation.';

drop trigger if exists cleanup_direct_conversation_pair_on_delete_trigger on conversation_participants;

create trigger cleanup_direct_conversation_pair_on_delete_trigger
    after delete on conversation_participants
    for each row execute function cleanup_direct_conversation_pair_on_delete();
