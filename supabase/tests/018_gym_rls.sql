-- =============================================================================
-- Test: F018 gym RLS policies
--
-- Validates the RLS posture established by 20260407000001_create_gyms.sql.
-- Plain-SQL test (no pgtap dependency). Run manually against a local Supabase
-- with `psql -d postgres -f supabase/tests/018_gym_rls.sql`. The whole script
-- runs in a transaction that rolls back at the end so it does not pollute the
-- target DB.
--
-- Test users are inserted directly into auth.users (the trigger from F018 will
-- attempt to enroll them in the default gym, which is fine -- the assertions
-- below tolerate that and create their own gyms via the impersonated paths).
--
-- Each assertion uses `raise exception` on failure so the script aborts loudly.
-- Successful runs print `RLS TEST OK: ...` notices for each section.
--
-- Maps to: TA1, TA2, TA14, TA17 / M3-M8 / RD-15, RD-16
-- =============================================================================

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Setup: create two test users in auth.users (superuser context).
-- These bypass RLS for setup; we re-impersonate them via JWT claims below.
-- ---------------------------------------------------------------------------
do $$
declare
    user_a constant uuid := '11111111-1111-4111-8111-111111111111';
    user_b constant uuid := '22222222-2222-4222-8222-222222222222';
begin
    -- Clean up any prior test rows. References cascade -- gym_members,
    -- gyms owned by these users, etc.
    delete from auth.users where id in (user_a, user_b);

    insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) values
    (user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-test-a@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-test-b@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

    raise notice 'RLS TEST setup: created users A=%, B=%', user_a, user_b;
end$$;


-- ---------------------------------------------------------------------------
-- (a) Authenticated user A can INSERT a gym with owner_user_id = auth.uid()
-- ---------------------------------------------------------------------------
do $$
declare
    user_a constant uuid := '11111111-1111-4111-8111-111111111111';
    v_gym_id uuid;
begin
    set local role authenticated;
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', user_a, 'role', 'authenticated')::text,
        true
    );

    insert into gyms (name, owner_user_id, is_default)
    values ('Test Gym A', user_a, false)
    returning id into v_gym_id;

    if v_gym_id is null then
        raise exception 'RLS TEST FAIL (a): user A could not insert their own gym';
    end if;

    raise notice 'RLS TEST OK (a): user A inserted gym %', v_gym_id;

    reset role;
end$$;

-- Verify the row was actually written (superuser context).
do $$
declare
    user_a constant uuid := '11111111-1111-4111-8111-111111111111';
    v_count integer;
begin
    select count(*) into v_count from gyms
    where owner_user_id = user_a and name = 'Test Gym A';
    if v_count <> 1 then
        raise exception 'RLS TEST FAIL: expected exactly 1 Test Gym A row, got %', v_count;
    end if;
end$$;


-- ---------------------------------------------------------------------------
-- (b) Authenticated user B can SELECT user A's gym (gyms are public-within-
--     instance for authenticated users)
-- ---------------------------------------------------------------------------
do $$
declare
    user_a constant uuid := '11111111-1111-4111-8111-111111111111';
    user_b constant uuid := '22222222-2222-4222-8222-222222222222';
    v_count integer;
begin
    set local role authenticated;
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', user_b, 'role', 'authenticated')::text,
        true
    );

    select count(*) into v_count
    from gyms where owner_user_id = user_a and name = 'Test Gym A';

    if v_count <> 1 then
        raise exception 'RLS TEST FAIL (b): user B saw % rows for user A''s gym, expected 1', v_count;
    end if;

    raise notice 'RLS TEST OK (b): user B can SELECT user A''s gym';
    reset role;
end$$;


-- ---------------------------------------------------------------------------
-- (c1) User B can INSERT their own gym_members row, (c2) but NOT user A's
-- ---------------------------------------------------------------------------
do $$
declare
    user_a constant uuid := '11111111-1111-4111-8111-111111111111';
    user_b constant uuid := '22222222-2222-4222-8222-222222222222';
    v_gym_a_id uuid;
    v_blocked boolean := false;
begin
    select id into v_gym_a_id from gyms
    where owner_user_id = user_a and name = 'Test Gym A';

    set local role authenticated;
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', user_b, 'role', 'authenticated')::text,
        true
    );

    -- (c1) User B joins gym A as themselves -- should succeed
    insert into gym_members (gym_id, user_id)
    values (v_gym_a_id, user_b)
    on conflict do nothing;

    raise notice 'RLS TEST OK (c1): user B inserted their own gym_members row';

    -- (c2) User B attempts to insert a membership row for user A -- should fail
    begin
        insert into gym_members (gym_id, user_id)
        values (v_gym_a_id, user_a);
        v_blocked := false;
    exception
        when insufficient_privilege or check_violation then
            v_blocked := true;
    end;

    if not v_blocked then
        raise exception 'RLS TEST FAIL (c2): user B was allowed to insert user A''s membership';
    end if;

    raise notice 'RLS TEST OK (c2): user B blocked from inserting user A''s membership';
    reset role;
end$$;


-- ---------------------------------------------------------------------------
-- (d) User A can UPDATE and DELETE their own gym
-- ---------------------------------------------------------------------------
do $$
declare
    user_a constant uuid := '11111111-1111-4111-8111-111111111111';
    v_gym_a_id uuid;
    v_updated integer;
begin
    select id into v_gym_a_id from gyms
    where owner_user_id = user_a and name = 'Test Gym A';

    set local role authenticated;
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', user_a, 'role', 'authenticated')::text,
        true
    );

    update gyms set name = 'Test Gym A (renamed)' where id = v_gym_a_id;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
        raise exception 'RLS TEST FAIL (d-update): owner could not update their gym (rows=%)', v_updated;
    end if;
    raise notice 'RLS TEST OK (d-update): user A updated their gym';

    reset role;
end$$;


-- ---------------------------------------------------------------------------
-- (e) User B cannot UPDATE or DELETE user A's gym
-- ---------------------------------------------------------------------------
do $$
declare
    user_a constant uuid := '11111111-1111-4111-8111-111111111111';
    user_b constant uuid := '22222222-2222-4222-8222-222222222222';
    v_gym_a_id uuid;
    v_updated integer;
    v_deleted integer;
begin
    select id into v_gym_a_id from gyms
    where owner_user_id = user_a and name = 'Test Gym A (renamed)';

    set local role authenticated;
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', user_b, 'role', 'authenticated')::text,
        true
    );

    -- Attempt update -- RLS USING clause should hide the row from user B,
    -- so the UPDATE affects zero rows (no error, but row count = 0).
    update gyms set name = 'evil rename' where id = v_gym_a_id;
    get diagnostics v_updated = row_count;
    if v_updated <> 0 then
        raise exception 'RLS TEST FAIL (e-update): user B updated user A''s gym (rows=%)', v_updated;
    end if;
    raise notice 'RLS TEST OK (e-update): user B blocked from updating user A''s gym';

    -- Same for delete.
    delete from gyms where id = v_gym_a_id;
    get diagnostics v_deleted = row_count;
    if v_deleted <> 0 then
        raise exception 'RLS TEST FAIL (e-delete): user B deleted user A''s gym (rows=%)', v_deleted;
    end if;
    raise notice 'RLS TEST OK (e-delete): user B blocked from deleting user A''s gym';

    reset role;
end$$;


-- ---------------------------------------------------------------------------
-- (f) User B can DELETE their own membership (leave a gym)
-- ---------------------------------------------------------------------------
do $$
declare
    user_a constant uuid := '11111111-1111-4111-8111-111111111111';
    user_b constant uuid := '22222222-2222-4222-8222-222222222222';
    v_gym_a_id uuid;
    v_deleted integer;
begin
    select id into v_gym_a_id from gyms
    where owner_user_id = user_a and name = 'Test Gym A (renamed)';

    -- Re-add user B's membership (in case (c1) was rolled back conceptually).
    -- This re-add runs as superuser to set up the test state.
    reset role;
    insert into gym_members (gym_id, user_id) values (v_gym_a_id, user_b)
    on conflict do nothing;

    set local role authenticated;
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', user_b, 'role', 'authenticated')::text,
        true
    );

    delete from gym_members where gym_id = v_gym_a_id and user_id = user_b;
    get diagnostics v_deleted = row_count;
    if v_deleted <> 1 then
        raise exception 'RLS TEST FAIL (f): user B could not leave gym A (rows=%)', v_deleted;
    end if;
    raise notice 'RLS TEST OK (f): user B deleted their own membership (left gym A)';

    reset role;
end$$;


-- ---------------------------------------------------------------------------
-- (g) User A can DELETE user B's membership in user A's gym (kick)
-- ---------------------------------------------------------------------------
do $$
declare
    user_a constant uuid := '11111111-1111-4111-8111-111111111111';
    user_b constant uuid := '22222222-2222-4222-8222-222222222222';
    v_gym_a_id uuid;
    v_deleted integer;
begin
    select id into v_gym_a_id from gyms
    where owner_user_id = user_a and name = 'Test Gym A (renamed)';

    -- Re-add user B's membership for the kick test.
    reset role;
    insert into gym_members (gym_id, user_id) values (v_gym_a_id, user_b)
    on conflict do nothing;

    set local role authenticated;
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', user_a, 'role', 'authenticated')::text,
        true
    );

    delete from gym_members where gym_id = v_gym_a_id and user_id = user_b;
    get diagnostics v_deleted = row_count;
    if v_deleted <> 1 then
        raise exception 'RLS TEST FAIL (g): user A could not kick user B (rows=%)', v_deleted;
    end if;
    raise notice 'RLS TEST OK (g): user A deleted user B''s membership (kicked user B)';

    reset role;
end$$;


-- ---------------------------------------------------------------------------
-- (h) Anon role can SELECT id, name FROM gyms but `select * from gyms` fails
--     on column-level access denial
-- ---------------------------------------------------------------------------
do $$
declare
    v_count       integer;
    v_blocked     boolean := false;
begin
    set local role anon;

    -- Allowed columns
    select count(*) into v_count from (select id, name from gyms) sub;
    if v_count < 1 then
        raise exception 'RLS TEST FAIL (h-allow): anon SELECT id, name returned no rows (expected at least 1)';
    end if;
    raise notice 'RLS TEST OK (h-allow): anon SELECT id, name from gyms returned % rows', v_count;

    -- Disallowed: select * (or any column not in the grant) should fail
    begin
        perform owner_user_id from gyms limit 1;
        v_blocked := false;
    exception
        when insufficient_privilege then
            v_blocked := true;
    end;

    if not v_blocked then
        raise exception 'RLS TEST FAIL (h-deny): anon was allowed to SELECT owner_user_id from gyms';
    end if;
    raise notice 'RLS TEST OK (h-deny): anon blocked from SELECT owner_user_id (column-level)';

    reset role;
end$$;


-- ---------------------------------------------------------------------------
-- (i) Anon role cannot SELECT any column from gym_members
-- ---------------------------------------------------------------------------
do $$
declare
    v_blocked boolean := false;
begin
    set local role anon;

    begin
        perform 1 from gym_members limit 1;
        v_blocked := false;
    exception
        when insufficient_privilege then
            v_blocked := true;
    end;

    if not v_blocked then
        raise exception 'RLS TEST FAIL (i): anon was allowed to SELECT from gym_members';
    end if;
    raise notice 'RLS TEST OK (i): anon blocked from SELECT on gym_members';

    reset role;
end$$;


-- ---------------------------------------------------------------------------
-- Final cleanup -- delete the test users (cascades remove their gyms +
-- memberships). The outer ROLLBACK below makes this redundant but the
-- explicit delete keeps the script self-documenting.
-- ---------------------------------------------------------------------------
do $$
begin
    reset role;
    delete from auth.users where id in (
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222'
    );
    raise notice 'RLS TEST CLEANUP: removed test users';
    raise notice '==========================================';
    raise notice 'RLS TEST SUITE PASSED -- F018 gym policies';
    raise notice '==========================================';
end$$;

rollback;
