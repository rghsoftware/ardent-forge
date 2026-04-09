-- =============================================================================
-- Test: F021 gym invite lifecycle
--
-- Asserts:
--   A-014: create_gym_invite produces token (length >= 24) and future expires_at
--   A-015: redeem_gym_invite increments uses_count and inserts gym_members row
--   A-016: expired invite -> exception 'INVITE_EXPIRED%'
--   A-017: exhausted invite (uses_count >= max_uses) -> 'INVITE_EXHAUSTED%'
--   A-018: non-owner SELECT on gym_invitations returns zero rows (RLS)
--
-- Plain SQL test, transaction-rollback at end. Run manually:
--   psql -d postgres -f supabase/tests/021_invite_lifecycle.sql
-- =============================================================================

\set ON_ERROR_STOP on

begin;

do $$
declare
    test_owner    constant uuid := '11111111-1111-4111-8111-111111111111';
    test_joiner   constant uuid := '22222222-2222-4222-8222-222222222222';
    test_outsider constant uuid := '33333333-3333-4333-8333-333333333333';
    v_gym_id      uuid;
    v_invite      public.gym_invitations;
    v_token       text;
    v_expired_id  uuid;
    v_exhausted_id uuid;
    v_uses        integer;
    v_member_count integer;
    v_redeemed_gym uuid;
    v_visible_count integer;
    v_caught      boolean;
begin
    -- ---- Setup: clean and create three users ------------------------------
    delete from auth.users where id in (test_owner, test_joiner, test_outsider);

    insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) values
    (test_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'f021-owner@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (test_joiner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'f021-joiner@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (test_outsider, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'f021-outsider@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

    -- Owner-created gym
    insert into public.gyms (name, owner_user_id)
    values ('F021 Test Gym', test_owner)
    returning id into v_gym_id;

    -- ---- A-014: create_gym_invite token + future expires_at ---------------
    perform set_config('request.jwt.claims',
        json_build_object('sub', test_owner::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    select * into v_invite from public.create_gym_invite(v_gym_id, null, 5);

    if v_invite.token is null or char_length(v_invite.token) < 24 then
        raise exception 'A-014 FAIL: token length < 24, got %', char_length(v_invite.token);
    end if;
    if v_invite.expires_at <= now() then
        raise exception 'A-014 FAIL: expires_at not in future: %', v_invite.expires_at;
    end if;
    raise notice 'A-014 OK: token length=%, expires_at=%', char_length(v_invite.token), v_invite.expires_at;

    v_token := v_invite.token;

    -- ---- A-015: redeem increments uses_count and inserts gym_members ------
    reset role;
    perform set_config('request.jwt.claims',
        json_build_object('sub', test_joiner::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    select public.redeem_gym_invite(v_token) into v_redeemed_gym;

    if v_redeemed_gym <> v_gym_id then
        raise exception 'A-015 FAIL: redeem returned wrong gym_id %', v_redeemed_gym;
    end if;

    reset role;
    select uses_count into v_uses from public.gym_invitations where id = v_invite.id;
    if v_uses <> 1 then
        raise exception 'A-015 FAIL: uses_count expected 1, got %', v_uses;
    end if;

    select count(*) into v_member_count
    from public.gym_members
    where gym_id = v_gym_id and user_id = test_joiner;
    if v_member_count <> 1 then
        raise exception 'A-015 FAIL: expected 1 gym_members row, got %', v_member_count;
    end if;
    raise notice 'A-015 OK: uses_count incremented and gym_members row inserted';

    -- ---- A-016: expired invite raises INVITE_EXPIRED ----------------------
    -- Insert directly (bypass RPC's "future" default) to fabricate expired row.
    insert into public.gym_invitations (gym_id, token, created_by, expires_at, max_uses)
    values (v_gym_id, 'expired-token-aaaaaaaaaaaaaaaaaaaaaaaa', test_owner,
            now() - interval '1 hour', 5)
    returning id into v_expired_id;

    perform set_config('request.jwt.claims',
        json_build_object('sub', test_joiner::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    v_caught := false;
    begin
        perform public.redeem_gym_invite('expired-token-aaaaaaaaaaaaaaaaaaaaaaaa');
    exception when others then
        if sqlerrm not like 'INVITE_EXPIRED%' then
            raise exception 'A-016 FAIL: expected INVITE_EXPIRED%%, got %', sqlerrm;
        end if;
        v_caught := true;
    end;
    if not v_caught then
        raise exception 'A-016 FAIL: expected exception, none raised';
    end if;
    raise notice 'A-016 OK: expired invite raised INVITE_EXPIRED';

    -- ---- A-017: exhausted invite raises INVITE_EXHAUSTED ------------------
    reset role;
    insert into public.gym_invitations (gym_id, token, created_by, expires_at, max_uses, uses_count)
    values (v_gym_id, 'exhausted-token-bbbbbbbbbbbbbbbbbbbbbbbb', test_owner,
            now() + interval '7 days', 2, 2)
    returning id into v_exhausted_id;

    perform set_config('request.jwt.claims',
        json_build_object('sub', test_joiner::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    v_caught := false;
    begin
        perform public.redeem_gym_invite('exhausted-token-bbbbbbbbbbbbbbbbbbbbbbbb');
    exception when others then
        if sqlerrm not like 'INVITE_EXHAUSTED%' then
            raise exception 'A-017 FAIL: expected INVITE_EXHAUSTED%%, got %', sqlerrm;
        end if;
        v_caught := true;
    end;
    if not v_caught then
        raise exception 'A-017 FAIL: expected exception, none raised';
    end if;
    raise notice 'A-017 OK: exhausted invite raised INVITE_EXHAUSTED';

    -- ---- A-018: non-owner SELECT on gym_invitations -> 0 rows (RLS) -------
    reset role;
    perform set_config('request.jwt.claims',
        json_build_object('sub', test_outsider::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    select count(*) into v_visible_count
    from public.gym_invitations
    where gym_id = v_gym_id;

    if v_visible_count <> 0 then
        raise exception 'A-018 FAIL: outsider saw % invite rows, expected 0', v_visible_count;
    end if;
    raise notice 'A-018 OK: non-owner sees 0 invite rows';

    -- Sanity: owner can see their invites.
    reset role;
    perform set_config('request.jwt.claims',
        json_build_object('sub', test_owner::text, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);

    select count(*) into v_visible_count
    from public.gym_invitations
    where gym_id = v_gym_id;

    if v_visible_count < 1 then
        raise exception 'A-018 FAIL (sanity): owner saw % invite rows, expected >= 1', v_visible_count;
    end if;
    raise notice 'A-018 OK (sanity): owner sees % invite rows', v_visible_count;

    reset role;
    raise notice '==========================================';
    raise notice 'F021 INVITE LIFECYCLE TESTS PASSED';
    raise notice '==========================================';
end$$;

rollback;
