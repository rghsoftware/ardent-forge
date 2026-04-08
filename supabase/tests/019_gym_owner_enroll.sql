-- =============================================================================
-- Test: F019 trg_gym_owner_enroll trigger
--
-- Validates that the gyms insert trigger auto-enrolls the owner in
-- gym_members so the creator immediately appears as a member of their own
-- gym (Spec.md TA1).
--
-- Verifies migration: supabase/migrations/20260407000004_enroll_gym_creator.sql
-- Renamed from 018_gym_owner_enroll.sql during F019 Wave 8 (P15-021) to
-- align the test number with the migration's feature scope and to rewrite
-- Section 2 to actually exercise the trigger function's idempotency path.
--
-- Plain SQL test, transaction-rollback at end. Run manually:
--   psql -d postgres -f supabase/tests/019_gym_owner_enroll.sql
--
-- Maps to: TA1 / F019 (rebased from F018 P14-018)
-- =============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Section 1: Owner is auto-enrolled when a gym is inserted
-- ---------------------------------------------------------------------------
do $$
declare
    test_owner constant uuid := '77777777-7777-4777-8777-777777777777';
    test_gym_id uuid;
    v_member_count integer;
begin
    -- Clean up any prior test rows.
    delete from auth.users where id = test_owner;

    -- Create the gym owner.
    insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        recovery_sent_at, last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token,
        email_change, email_change_token_new, recovery_token
    ) values (
        test_owner, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'f019-owner@test.local',
        crypt('test-password', gen_salt('bf')), now(),
        null, null,
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        now(), now(), '', '', '', ''
    );

    -- Insert the gym -- the trigger should fire and create the membership.
    insert into public.gyms (name, owner_user_id, is_default)
    values ('F019 Test Gym', test_owner, false)
    returning id into test_gym_id;

    -- Assert: exactly one membership row for the owner pointing at the new gym.
    select count(*) into v_member_count
    from public.gym_members
    where gym_id = test_gym_id and user_id = test_owner;

    if v_member_count <> 1 then
        raise exception 'Expected 1 membership row for owner after gym insert, got %', v_member_count;
    end if;

    raise notice 'Section 1 passed: owner auto-enrolled in newly created gym';
end $$;

-- ---------------------------------------------------------------------------
-- Section 2: Trigger function is idempotent against pre-existing membership
--
-- The trigger's production declaration only fires on INSERT, so the only
-- way to exercise the `on conflict do nothing` clause inside the trigger
-- function itself is to:
--
--   1. Drop the production `after insert` trigger.
--   2. Insert a gym row -- with no trigger, no membership is created.
--   3. Manually insert the gym_members row (simulating a backfill or a
--      prior run of the trigger that left the row behind).
--   4. Re-create the trigger locally with `insert or update` scope so we
--      can re-fire it against the existing membership without needing a
--      fresh gym insert (a new insert would use a new gym_id and never
--      hit the conflict path).
--   5. Update the gym row to fire the (re-created) trigger -- the trigger
--      function now encounters a pre-existing (gym_id, user_id) row and
--      must swallow the duplicate via `on conflict do nothing` rather
--      than raising a unique_violation that would abort the update.
--
-- Note: the locally re-created trigger's `or update` scope differs from
-- production, but this test is specifically verifying the trigger
-- FUNCTION's `on conflict do nothing` clause, not the trigger declaration.
-- Because the entire test runs in a transaction that ends with `rollback`,
-- the schema change is reverted and production is unaffected.
--
-- P15-021: this replaces the previous Section 2 that tested the standalone
-- `on conflict do nothing` on a hand-crafted duplicate insert, which would
-- still pass even if the trigger's own `on conflict do nothing` clause were
-- removed. The rewrite actually exercises the trigger function's conflict
-- path so future removals of that clause are caught.
-- ---------------------------------------------------------------------------
do $$
declare
    test_owner constant uuid := '88888888-8888-4888-8888-888888888888';
    test_gym_id constant uuid := '99999999-9999-4999-8999-999999999999';
    v_member_count integer;
begin
    delete from auth.users where id = test_owner;
    delete from public.gyms where id = test_gym_id;

    -- Create the gym owner.
    insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        recovery_sent_at, last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token,
        email_change, email_change_token_new, recovery_token
    ) values (
        test_owner, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'f019-idempotent@test.local',
        crypt('test-password', gen_salt('bf')), now(),
        null, null,
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        now(), now(), '', '', '', ''
    );

    -- (1) Drop the production trigger so we can insert a gym without the
    -- trigger firing and creating its own membership row.
    drop trigger trg_gym_owner_enroll on public.gyms;

    -- (2) Insert the gym. With the trigger gone, no membership is created.
    insert into public.gyms (id, name, owner_user_id, is_default)
    values (test_gym_id, 'F019 Idempotent Test', test_owner, false);

    -- Sanity check: no membership yet (trigger was dropped).
    select count(*) into v_member_count
    from public.gym_members
    where gym_id = test_gym_id and user_id = test_owner;
    if v_member_count <> 0 then
        raise exception 'Expected 0 memberships before manual insert, got %', v_member_count;
    end if;

    -- (3) Simulate a hand-backfill: directly insert the membership row
    -- that the trigger would have inserted.
    insert into public.gym_members (gym_id, user_id)
    values (test_gym_id, test_owner);

    -- (4) Re-create the trigger with `insert or update` scope so we can
    -- re-fire the trigger function against the existing membership. This
    -- is a test-local change -- the transaction `rollback` at the bottom
    -- of the file reverts it.
    create trigger trg_gym_owner_enroll
        after insert or update on public.gyms
        for each row execute function public.enroll_owner_in_new_gym();

    -- (5) Update the gym to re-fire the trigger. The trigger function now
    -- encounters a pre-existing (gym_id, user_id) row and must swallow
    -- the duplicate via `on conflict do nothing`. If that clause were
    -- removed from the function, this update would raise a
    -- unique_violation and the test would fail.
    begin
        update public.gyms
        set name = name || ' v2'
        where id = test_gym_id;
    exception
        when unique_violation then
            raise exception
                'Trigger function is NOT idempotent: unique_violation raised when trigger fired against pre-existing membership. '
                'Has the `on conflict do nothing` clause been removed from public.enroll_owner_in_new_gym()?';
    end;

    -- Assert: the update succeeded and there is still exactly one
    -- membership row (the one inserted in step 3).
    select count(*) into v_member_count
    from public.gym_members
    where gym_id = test_gym_id and user_id = test_owner;

    if v_member_count <> 1 then
        raise exception
            'Expected exactly 1 membership row after trigger re-fired against existing row, got %',
            v_member_count;
    end if;

    raise notice 'Section 2 passed: trigger function is idempotent against pre-existing membership';
end $$;

rollback;

\echo '====================================================='
\echo 'F019 trg_gym_owner_enroll trigger test PASSED'
\echo '====================================================='
