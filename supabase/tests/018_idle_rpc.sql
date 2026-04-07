-- =============================================================================
-- Test: F018 get_display_idle_sessions(p_gym_id) RPC
--
-- Validates that the gym-scoped variant of the idle sessions RPC returns only
-- members of the gym passed as the parameter, and that two gyms with disjoint
-- members produce disjoint result sets.
--
-- Plain SQL test, transaction-rollback at end. Run manually:
--   psql -d postgres -f supabase/tests/018_idle_rpc.sql
--
-- Maps to: TA10, M18 / D6
-- =============================================================================

\set ON_ERROR_STOP on

begin;

do $$
declare
    user_a   constant uuid := '33333333-3333-4333-8333-333333333333';
    user_b   constant uuid := '44444444-4444-4444-8444-444444444444';
    gym_a_id uuid;
    gym_b_id uuid;
    prog_a   constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    prog_b   constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    blk_a    constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
    blk_b    constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc';
    bw_a     constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac';
    bw_b     constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbd';
    st_a     constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad';
    st_b     constant uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbe';
    today_dow integer := extract(dow from now())::integer;
    v_count_a integer;
    v_count_b integer;
    v_first_name_a text;
    v_first_name_b text;
begin
    -- -------------------------------------------------------------------------
    -- Cleanup any prior test rows.
    -- -------------------------------------------------------------------------
    delete from auth.users where id in (user_a, user_b);

    -- -------------------------------------------------------------------------
    -- 1. Create two test users with display names so we can identify the
    --    rows in the RPC output.
    -- -------------------------------------------------------------------------
    insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) values
    (user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rpc-test-a@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rpc-test-b@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

    insert into user_profiles (id, display_name, preferred_units)
    values
    (user_a, 'RPC Test User A', 'IMPERIAL'),
    (user_b, 'RPC Test User B', 'IMPERIAL')
    on conflict (id) do update set display_name = excluded.display_name;

    -- -------------------------------------------------------------------------
    -- 2. Create two non-default gyms with disjoint membership.
    -- -------------------------------------------------------------------------
    insert into gyms (name, owner_user_id, is_default)
    values
    ('RPC Test Gym A', user_a, false),
    ('RPC Test Gym B', user_b, false)
    returning id into gym_a_id;
    -- Need a separate select for gym B since RETURNING + multi-row inserts
    -- can only return one ID per statement.

    select id into gym_a_id from gyms where name = 'RPC Test Gym A';
    select id into gym_b_id from gyms where name = 'RPC Test Gym B';

    -- The auth.users trigger may have already enrolled both users in any
    -- pre-existing default gym; but neither user is a member of the test gyms
    -- yet. Enroll them now -- A in gym A, B in gym B (disjoint).
    insert into gym_members (gym_id, user_id) values
    (gym_a_id, user_a),
    (gym_b_id, user_b);

    -- -------------------------------------------------------------------------
    -- 3. Build the program-activation -> scheduled-session graph for each
    --    user. Each user gets a one-block, one-week program with a single
    --    scheduled session for TODAY (so the RPC's day_of_week filter passes).
    -- -------------------------------------------------------------------------
    -- Programs (deterministic IDs)
    insert into programs (id, user_id, name, source, duration_weeks)
    values
    (prog_a, user_a, 'RPC Test Program A', 'CUSTOM', 1),
    (prog_b, user_b, 'RPC Test Program B', 'CUSTOM', 1);

    -- Blocks
    insert into blocks (id, program_id, name, ordinal, duration_weeks, block_type)
    values
    (blk_a, prog_a, 'RPC Block A', 1, 1, 'ACCUMULATION'),
    (blk_b, prog_b, 'RPC Block B', 1, 1, 'ACCUMULATION');

    -- Block weeks (week 1 of each block)
    insert into block_weeks (id, block_id, week_number)
    values
    (bw_a, blk_a, 1),
    (bw_b, blk_b, 1);

    -- Session templates
    insert into session_templates (id, user_id, name, category)
    values
    (st_a, user_a, 'RPC Session Template A', 'STRENGTH'),
    (st_b, user_b, 'RPC Session Template B', 'STRENGTH');

    -- Scheduled sessions for TODAY
    insert into scheduled_sessions
        (block_week_id, day_of_week, day_label, session_type, session_template_id)
    values
    (bw_a, today_dow, 'Day RPC A', 'STRENGTH', st_a),
    (bw_b, today_dow, 'Day RPC B', 'STRENGTH', st_b);

    -- Program activations: each user is on week 1 of their program
    insert into program_activations
        (user_id, program_id, current_block_ordinal, current_week_number, start_date)
    values
    (user_a, prog_a, 1, 1, current_date),
    (user_b, prog_b, 1, 1, current_date)
    on conflict (user_id) do update set
        program_id = excluded.program_id,
        current_block_ordinal = excluded.current_block_ordinal,
        current_week_number = excluded.current_week_number,
        start_date = excluded.start_date;

    -- -------------------------------------------------------------------------
    -- 4. Call the RPC for gym A. Expect exactly one row, for User A.
    -- -------------------------------------------------------------------------
    select count(*), max(display_name)
    into v_count_a, v_first_name_a
    from public.get_display_idle_sessions(gym_a_id)
    where display_name like 'RPC Test User%';

    if v_count_a <> 1 then
        raise exception
            'RPC TEST FAIL (gym A): expected 1 row, got % (display_name=%)',
            v_count_a, v_first_name_a;
    end if;
    if v_first_name_a <> 'RPC Test User A' then
        raise exception
            'RPC TEST FAIL (gym A): expected display_name "RPC Test User A", got %',
            v_first_name_a;
    end if;
    raise notice 'RPC TEST OK (gym A): exactly 1 row, display_name=%', v_first_name_a;

    -- -------------------------------------------------------------------------
    -- 5. Call the RPC for gym B. Expect exactly one row, for User B.
    -- -------------------------------------------------------------------------
    select count(*), max(display_name)
    into v_count_b, v_first_name_b
    from public.get_display_idle_sessions(gym_b_id)
    where display_name like 'RPC Test User%';

    if v_count_b <> 1 then
        raise exception
            'RPC TEST FAIL (gym B): expected 1 row, got % (display_name=%)',
            v_count_b, v_first_name_b;
    end if;
    if v_first_name_b <> 'RPC Test User B' then
        raise exception
            'RPC TEST FAIL (gym B): expected display_name "RPC Test User B", got %',
            v_first_name_b;
    end if;
    raise notice 'RPC TEST OK (gym B): exactly 1 row, display_name=%', v_first_name_b;

    -- -------------------------------------------------------------------------
    -- 6. Sanity: an unrelated random gym ID returns zero of OUR test rows.
    --    (Other rows from the existing dev DB may be present; we filter to
    --    our test prefix.)
    -- -------------------------------------------------------------------------
    select count(*) into v_count_a
    from public.get_display_idle_sessions(gen_random_uuid())
    where display_name like 'RPC Test User%';

    if v_count_a <> 0 then
        raise exception
            'RPC TEST FAIL (random gym): expected 0 of our test rows, got %', v_count_a;
    end if;
    raise notice 'RPC TEST OK (random gym): zero of our test rows returned';

    raise notice '==========================================';
    raise notice 'RPC TEST SUITE PASSED -- F018 idle RPC';
    raise notice '==========================================';
end$$;

rollback;
