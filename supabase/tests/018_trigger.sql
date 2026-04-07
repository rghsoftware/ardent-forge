-- =============================================================================
-- Test: F018 trg_auth_user_default_gym trigger
--
-- Validates that the auth.users insert trigger auto-enrolls new users in the
-- default gym (the row where gyms.is_default = true), and that the trigger
-- short-circuits cleanly when no default gym exists.
--
-- Plain SQL test, transaction-rollback at end. Run manually:
--   psql -d postgres -f supabase/tests/018_trigger.sql
--
-- Maps to: TA20 / S7 / D7
-- =============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Section 1: Default gym exists -> trigger enrolls the new user
--
-- We don't know whether the dev DB already has a default gym from the
-- F018 data migration. To make this test deterministic, we deliberately
-- ensure a default gym exists and capture its id, then create a new user
-- and assert exactly one membership row pointing at that gym.
-- ---------------------------------------------------------------------------
do $$
declare
    test_owner constant uuid := '55555555-5555-4555-8555-555555555555';
    test_user1 constant uuid := '66666666-6666-4666-8666-666666666666';
    v_default_gym_id uuid;
    v_member_count integer;
    v_existing_default uuid;
begin
    -- Clean up any prior test rows.
    delete from auth.users where id in (test_owner, test_user1);

    -- Create the gym owner first (test_owner is its own user).
    insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) values
    (test_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'trigger-test-owner@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

    -- Use the existing default gym if there is one (the data migration
    -- creates one). Otherwise create a fresh default for this test.
    select id into v_existing_default from gyms where is_default = true;
    if v_existing_default is not null then
        v_default_gym_id := v_existing_default;
        raise notice 'TRIGGER TEST: using existing default gym %', v_default_gym_id;
    else
        insert into gyms (name, owner_user_id, is_default)
        values ('Trigger Test Default', test_owner, true)
        returning id into v_default_gym_id;
        raise notice 'TRIGGER TEST: created default gym %', v_default_gym_id;
    end if;

    -- Now create the second test user. The trigger should fire and enroll
    -- them in v_default_gym_id.
    insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) values
    (test_user1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'trigger-test-user1@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

    -- Assert: test_user1 has exactly one row in gym_members for v_default_gym_id.
    select count(*) into v_member_count
    from gym_members
    where user_id = test_user1 and gym_id = v_default_gym_id;

    if v_member_count <> 1 then
        raise exception
            'TRIGGER TEST FAIL (default exists): expected 1 membership row for new user in default gym, got %',
            v_member_count;
    end if;

    raise notice 'TRIGGER TEST OK (default exists): new user enrolled in default gym';
end$$;


-- ---------------------------------------------------------------------------
-- Section 2: No default gym -> trigger no-ops, new user has no membership
--
-- Use a savepoint so we can drop the default gym in isolation. The savepoint
-- is rolled back after the assertion so the rest of the suite (and the
-- outer ROLLBACK) does not see the missing default.
-- ---------------------------------------------------------------------------
savepoint no_default;

do $$
declare
    test_user2 constant uuid := '77777777-7777-4777-8777-777777777777';
    v_member_count integer;
    v_existing_default_count integer;
begin
    delete from auth.users where id = test_user2;

    -- Drop ALL default gyms (cascade-deletes their members; the partial
    -- unique index allows zero defaults).
    delete from gyms where is_default = true;

    -- Sanity: no defaults remain.
    select count(*) into v_existing_default_count from gyms where is_default = true;
    if v_existing_default_count <> 0 then
        raise exception
            'TRIGGER TEST setup: expected 0 default gyms after delete, got %',
            v_existing_default_count;
    end if;

    -- Create the user. The trigger should fire but find no default and
    -- silently no-op.
    insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) values
    (test_user2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'trigger-test-user2@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

    -- Assert: test_user2 has zero rows in gym_members.
    select count(*) into v_member_count
    from gym_members
    where user_id = test_user2;

    if v_member_count <> 0 then
        raise exception
            'TRIGGER TEST FAIL (no default): expected 0 membership rows for new user, got %',
            v_member_count;
    end if;

    raise notice 'TRIGGER TEST OK (no default): trigger no-op when no default gym exists';
end$$;

rollback to savepoint no_default;
release savepoint no_default;


-- ---------------------------------------------------------------------------
-- Final cleanup notice. The outer ROLLBACK below makes the actual cleanup
-- automatic, but we keep the explicit notice for visibility.
-- ---------------------------------------------------------------------------
do $$
begin
    raise notice '==========================================';
    raise notice 'TRIGGER TEST SUITE PASSED -- F018 trigger';
    raise notice '==========================================';
end$$;

rollback;
