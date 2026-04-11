-- =============================================================================
-- Test: F021 is_default / auto-enroll teardown
--
-- Validates that 20260408000002_gym_membership_explicit.sql successfully
-- removed the F018 auto-enroll-on-signup machinery and the gyms.is_default
-- column, and that pre-existing gym_members rows backfilled by
-- 20260407000004_enroll_gym_creator.sql survived the migration.
--
-- Plain SQL test, transaction-rollback at end. Run manually:
--   psql -d postgres -f supabase/tests/021_is_default_drop.sql
--
-- Maps to: F021 A-001, A-002, A-003, A-006
-- =============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- A-001: trigger trg_auth_user_default_gym no longer exists on auth.users
-- ---------------------------------------------------------------------------
do $$
declare
    v_count integer;
begin
    select count(*) into v_count
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_auth_user_default_gym'
      and n.nspname = 'auth'
      and c.relname = 'users'
      and not t.tgisinternal;

    if v_count <> 0 then
        raise exception
            'F021 TEST FAIL (A-001): trigger trg_auth_user_default_gym still exists on auth.users (found % row(s))',
            v_count;
    end if;

    raise notice 'F021 TEST OK (A-001): trg_auth_user_default_gym is gone';
end$$;


-- ---------------------------------------------------------------------------
-- A-002: function public.enroll_new_user_in_default_gym no longer exists
-- ---------------------------------------------------------------------------
do $$
declare
    v_count integer;
begin
    select count(*) into v_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'enroll_new_user_in_default_gym';

    if v_count <> 0 then
        raise exception
            'F021 TEST FAIL (A-002): function public.enroll_new_user_in_default_gym still exists (found % row(s))',
            v_count;
    end if;

    raise notice 'F021 TEST OK (A-002): public.enroll_new_user_in_default_gym is gone';
end$$;


-- ---------------------------------------------------------------------------
-- A-003: column gyms.is_default no longer exists
-- ---------------------------------------------------------------------------
do $$
declare
    v_count integer;
begin
    select count(*) into v_count
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'gyms'
      and column_name = 'is_default';

    if v_count <> 0 then
        raise exception
            'F021 TEST FAIL (A-003): column public.gyms.is_default still exists (found % row(s))',
            v_count;
    end if;

    raise notice 'F021 TEST OK (A-003): public.gyms.is_default is gone';
end$$;


-- ---------------------------------------------------------------------------
-- A-006: backfilled gym_members rows survive the migration
--
-- 20260407000004_enroll_gym_creator.sql installs trg_gym_owner_enroll, which
-- enrolls every gym's owner_user_id as a member. After F021 ships, that
-- invariant must still hold for every existing gym -- the explicit-membership
-- migration is not allowed to drop or orphan any (gym_id, owner_user_id) row
-- that the F018/P14-018 backfill produced.
-- ---------------------------------------------------------------------------
do $$
declare
    v_missing integer;
    v_total_gyms integer;
begin
    select count(*) into v_total_gyms from public.gyms;

    select count(*) into v_missing
    from public.gyms g
    where g.owner_user_id is not null
      and not exists (
          select 1 from public.gym_members gm
          where gm.gym_id = g.id
            and gm.user_id = g.owner_user_id
      );

    if v_missing <> 0 then
        raise exception
            'F021 TEST FAIL (A-006): % gym(s) out of % are missing the owner-as-member backfill row after F021',
            v_missing, v_total_gyms;
    end if;

    raise notice 'F021 TEST OK (A-006): all % gym(s) retain their owner gym_members backfill row', v_total_gyms;
end$$;


-- ---------------------------------------------------------------------------
-- Final summary
-- ---------------------------------------------------------------------------
do $$
begin
    raise notice '==========================================';
    raise notice 'F021 IS_DEFAULT-DROP TEST SUITE PASSED';
    raise notice '  A-001 trigger gone';
    raise notice '  A-002 function gone';
    raise notice '  A-003 column gone';
    raise notice '  A-006 backfill preserved';
    raise notice '==========================================';
end$$;

rollback;
