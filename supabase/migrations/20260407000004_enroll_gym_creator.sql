-- ============================================================================
-- F018 P14-018: enroll the creator of a new gym in gym_members automatically.
--
-- The original `createGym` flow inserts only into `gyms`, leaving the creator
-- absent from `gym_members`. This directly violates Spec.md TA1 ("a new
-- authenticated user can create a gym; they appear as owner_user_id and as a
-- row in gym_members") and ships a broken creator experience: the gym does
-- not appear in `MyGymsList` (joined via gym_members), the picker can't find
-- it at workout start, and the creator cannot broadcast to their own gym.
--
-- The fix is a database-side trigger so EVERY code path that inserts a row
-- into `gyms` -- supabase-adapter, seed scripts, future RPCs, manual SQL --
-- enrolls the owner without callers having to remember.
--
-- security definer + locked search_path is the canonical pattern for triggers
-- that touch RLS-protected tables (matches `enroll_new_user_in_default_gym`
-- in 20260407000001_create_gyms.sql). `on conflict do nothing` keeps the
-- trigger idempotent against retries -- if a future migration ever inserts
-- the row by hand before the trigger fires (e.g., during a backfill), this
-- avoids a unique-violation error that would silently break gym creation.
-- ============================================================================

create or replace function public.enroll_owner_in_new_gym()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.owner_user_id is not null then
        insert into public.gym_members (gym_id, user_id)
        values (new.id, new.owner_user_id)
        on conflict do nothing;
    end if;
    return new;
end;
$$;

comment on function public.enroll_owner_in_new_gym() is
    'Trigger function: auto-enrolls the owner of a freshly inserted gyms '
    'row as a member of that gym. Closes the gap between gym creation and '
    'membership visibility (Spec F018 TA1, P14-018). Idempotent via '
    'on conflict do nothing.';

create trigger trg_gym_owner_enroll
    after insert on public.gyms
    for each row execute function public.enroll_owner_in_new_gym();

comment on trigger trg_gym_owner_enroll on public.gyms is
    'Fires after every insert into gyms. Enrolls owner_user_id in '
    'gym_members so the creator immediately appears in their own MyGymsList '
    'and can pick the gym at workout start.';
