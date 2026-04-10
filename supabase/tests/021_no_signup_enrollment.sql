-- =============================================================================
-- Test: F021 no-auto-enrollment-on-signup + creator enrollment regression
--
-- Validates that after migration 20260408000002_gym_membership_explicit:
--   A-004: inserting a new auth.users row produces ZERO gym_members rows for
--          that user (the F018 trg_auth_user_default_gym trigger is gone)
--   A-005: REGRESSION -- inserting a new gyms row still auto-enrolls the
--          owner via the F018 trg_gym_owner_enroll trigger from
--          20260407000004_enroll_gym_creator.sql
--
-- Plain SQL test, transaction-rollback at end. Run manually:
--   psql -d postgres -f supabase/tests/021_no_signup_enrollment.sql
--
-- Maps to: F021 S004-T2 / A-004 / A-005
-- =============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Section 1 (A-004): New auth.users insert => zero gym_members for that user
--
-- After F021 the trg_auth_user_default_gym trigger and its function are
-- dropped. Creating a fresh user must NOT produce any membership rows,
-- regardless of whether other gyms exist in the database.
-- ---------------------------------------------------------------------------
do $$
declare
    test_user_a constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    v_member_count integer;
    v_trigger_exists boolean;
    v_function_exists boolean;
begin
    -- Sanity: the F018 signup trigger and function should be gone after F021.
    select exists (
        select 1 from pg_trigger
        where tgname = 'trg_auth_user_default_gym'
    ) into v_trigger_exists;

    if v_trigger_exists then
        raise exception
            'F021 TEST FAIL (A-004): trg_auth_user_default_gym still exists; '
            'F021 migration should have dropped it';
    end if;

    select exists (
        select 1 from pg_proc
        where proname = 'enroll_new_user_in_default_gym'
          and pronamespace = 'public'::regnamespace
    ) into v_function_exists;

    if v_function_exists then
        raise exception
            'F021 TEST FAIL (A-004): public.enroll_new_user_in_default_gym() '
            'still exists; F021 migration should have dropped it';
    end if;

    -- Clean up any prior test rows.
    delete from auth.users where id = test_user_a;

    -- Create a fresh user. With the trigger gone, no membership rows should
    -- appear for this user under any circumstances.
    insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) values
    (test_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'f021-test-no-enroll@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

    select count(*) into v_member_count
    from gym_members
    where user_id = test_user_a;

    if v_member_count <> 0 then
        raise exception
            'F021 TEST FAIL (A-004): expected 0 membership rows for newly '
            'signed-up user, got %', v_member_count;
    end if;

    raise notice 'F021 TEST OK (A-004): new auth.users insert produced 0 gym_members rows';
end$$;


-- ---------------------------------------------------------------------------
-- Section 2 (A-005, REGRESSION): New gyms insert => owner is auto-enrolled
--
-- The F018 trg_gym_owner_enroll trigger from 20260407000004_enroll_gym_creator
-- must survive the F021 migration. Inserting a gyms row with a non-null
-- owner_user_id must produce exactly one matching gym_members row for the
-- owner, without any application-level help.
-- ---------------------------------------------------------------------------
do $$
declare
    test_owner constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    v_gym_id uuid;
    v_member_count integer;
    v_trigger_exists boolean;
begin
    -- Sanity: the creator-enroll trigger should still exist after F021.
    select exists (
        select 1 from pg_trigger
        where tgname = 'trg_gym_owner_enroll'
    ) into v_trigger_exists;

    if not v_trigger_exists then
        raise exception
            'F021 TEST FAIL (A-005): trg_gym_owner_enroll is missing; F021 '
            'migration should NOT have dropped the creator-enroll trigger';
    end if;

    -- Clean up any prior test rows.
    delete from auth.users where id = test_owner;

    -- Create the gym owner user. Per Section 1 this should NOT enroll them
    -- in anything by itself.
    insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) values
    (test_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'f021-test-owner@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

    -- Direct insert into gyms (mirrors what supabase-adapter createGym does).
    insert into gyms (name, owner_user_id)
    values ('F021 Regression Test Gym', test_owner)
    returning id into v_gym_id;

    -- Assert: exactly one gym_members row for (v_gym_id, test_owner).
    select count(*) into v_member_count
    from gym_members
    where gym_id = v_gym_id and user_id = test_owner;

    if v_member_count <> 1 then
        raise exception
            'F021 TEST FAIL (A-005): expected 1 membership row for gym '
            'creator, got %', v_member_count;
    end if;

    raise notice 'F021 TEST OK (A-005): gym creator auto-enrolled via trg_gym_owner_enroll';
end$$;


-- ---------------------------------------------------------------------------
-- Final notice. Outer ROLLBACK reverts all test rows.
-- ---------------------------------------------------------------------------
do $$
begin
    raise notice '==========================================';
    raise notice 'F021 TEST SUITE PASSED -- A-004, A-005';
    raise notice '==========================================';
end$$;

rollback;
