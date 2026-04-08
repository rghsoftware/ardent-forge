-- =============================================================================
-- Migration: Lock execute grants on F018 gym helper functions
-- Description: Brings the three security-definer functions added by F018
--              (is_gym_member, is_gym_owner, enroll_new_user_in_default_gym)
--              up to the project default-deny convention.
--
-- The prior migration (20260407000001_create_gyms.sql) created these functions
-- but did not explicitly revoke/grant EXECUTE, unlike the house pattern used
-- in 20260404000002_get_secret_function.sql and 20260407000002. The F018 S028
-- security audit flagged this as a CONCERN (not exploitable, but a deviation
-- from convention). This migration closes the gap.
--
-- Also normalizes enroll_new_user_in_default_gym to use `set search_path = ''`
-- (the stricter idiom already used by is_gym_member and is_gym_owner). The
-- function body was already fully qualified (public.gyms, public.gym_members)
-- so no body changes are required.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. is_gym_member / is_gym_owner: called from RLS policies, which evaluate
--    as the calling user's role. `authenticated` needs EXECUTE for the
--    policies to fire. Revoke the permissive public default and the anon
--    role (neither has any business calling these).
-- ---------------------------------------------------------------------------
revoke execute on function public.is_gym_member(uuid) from public;
revoke execute on function public.is_gym_member(uuid) from anon;
grant  execute on function public.is_gym_member(uuid) to authenticated;

revoke execute on function public.is_gym_owner(uuid) from public;
revoke execute on function public.is_gym_owner(uuid) from anon;
grant  execute on function public.is_gym_owner(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 2. enroll_new_user_in_default_gym: only the `auth.users` insert trigger
--    invokes this. No user-facing role has any reason to call it directly
--    (and the `new` reference would be unbound outside the trigger context
--    anyway, which is why the prior permissive grant was not exploitable).
-- ---------------------------------------------------------------------------
revoke execute on function public.enroll_new_user_in_default_gym() from public;
revoke execute on function public.enroll_new_user_in_default_gym() from anon;
revoke execute on function public.enroll_new_user_in_default_gym() from authenticated;


-- ---------------------------------------------------------------------------
-- 3. Normalize the search_path idiom on enroll_new_user_in_default_gym to
--    match is_gym_member / is_gym_owner (`set search_path = ''` with fully
--    qualified references in the body). Body is unchanged because it already
--    qualifies every object reference with the `public.` prefix.
--
--    CREATE OR REPLACE preserves the function's ownership and permissions,
--    so the revokes above are still in effect after this statement.
-- ---------------------------------------------------------------------------
create or replace function public.enroll_new_user_in_default_gym()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_default_gym_id uuid;
begin
    select id into v_default_gym_id
    from public.gyms
    where is_default = true
    limit 1;

    if v_default_gym_id is not null then
        insert into public.gym_members (gym_id, user_id)
        values (v_default_gym_id, new.id)
        on conflict do nothing;
    end if;

    return new;
end;
$$;
