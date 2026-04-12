-- =============================================================================
-- Test: F021 gym ownership transfer RPCs
--
-- Validates A-012, A-013, A-013a, A-013b, A-013c for the
-- propose_gym_transfer / accept_gym_transfer / cancel_or_decline_gym_transfer
-- security-definer RPC surface introduced in
-- 20260408000002_gym_membership_explicit.sql.
--
-- Run manually:
--   psql -d postgres -f supabase/tests/021_ownership_transfer.sql
-- =============================================================================

\set ON_ERROR_STOP on

begin;

do $$
declare
    owner_id    constant uuid := 'a1111111-1111-4111-8111-111111111111';
    member_id   constant uuid := 'a2222222-2222-4222-8222-222222222222';
    outsider_id constant uuid := 'a3333333-3333-4333-8333-333333333333';
    v_gym_id          uuid;
    v_pending_count   integer;
    v_owner_after     uuid;
    v_caught_msg      text;
begin
    -- ---------------------------------------------------------------------
    -- Seed: two users + one gym, second user is a member of the gym.
    -- ---------------------------------------------------------------------
    delete from auth.users where id in (owner_id, member_id, outsider_id);

    insert into auth.users (
        id, instance_id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
    ) values
    (owner_id,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'transfer-owner@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (member_id,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'transfer-member@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
    (outsider_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'transfer-outsider@example.test', '', now(),
     '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now());

    insert into public.gyms (name, owner_user_id)
    values ('Transfer Test Gym', owner_id)
    returning id into v_gym_id;

    -- Add member_id as a gym member (outsider_id intentionally NOT a member).
    insert into public.gym_members (gym_id, user_id)
    values (v_gym_id, member_id)
    on conflict do nothing;

    -- ---------------------------------------------------------------------
    -- A-012: propose_gym_transfer creates a pending row, gyms.owner_user_id
    -- is unchanged.
    -- ---------------------------------------------------------------------
    perform set_config('request.jwt.claim.sub', owner_id::text, true);
    perform set_config('request.jwt.claims',
        json_build_object('sub', owner_id::text)::text, true);

    perform public.propose_gym_transfer(v_gym_id, member_id);

    select count(*) into v_pending_count
    from public.gym_ownership_transfers
    where gym_id = v_gym_id
      and proposed_by = owner_id
      and proposed_to = member_id;
    if v_pending_count <> 1 then
        raise exception
            'A-012 FAIL: expected 1 pending transfer row, got %', v_pending_count;
    end if;

    select owner_user_id into v_owner_after from public.gyms where id = v_gym_id;
    if v_owner_after <> owner_id then
        raise exception
            'A-012 FAIL: gyms.owner_user_id changed prematurely (got %, expected %)',
            v_owner_after, owner_id;
    end if;
    raise notice 'A-012 OK: propose creates pending row, owner unchanged';

    -- ---------------------------------------------------------------------
    -- A-013c: single-pending invariant -- a second propose for the same gym
    -- supersedes the first via on conflict (gym_id) do update.
    -- We re-propose to outsider_id (not yet a member), which would normally
    -- fail; instead we make outsider_id a member temporarily, then re-propose,
    -- then remove them again.
    -- ---------------------------------------------------------------------
    insert into public.gym_members (gym_id, user_id)
    values (v_gym_id, outsider_id)
    on conflict do nothing;

    perform public.propose_gym_transfer(v_gym_id, outsider_id);

    select count(*) into v_pending_count
    from public.gym_ownership_transfers
    where gym_id = v_gym_id;
    if v_pending_count <> 1 then
        raise exception
            'A-013c FAIL: expected exactly 1 pending row after supersede, got %',
            v_pending_count;
    end if;

    select count(*) into v_pending_count
    from public.gym_ownership_transfers
    where gym_id = v_gym_id and proposed_to = outsider_id;
    if v_pending_count <> 1 then
        raise exception
            'A-013c FAIL: expected superseded row to target outsider';
    end if;
    raise notice 'A-013c OK: second propose supersedes the first';

    -- Reset back to a transfer to member_id and remove outsider's membership
    -- so the next assertion can use outsider as a non-member target.
    perform public.propose_gym_transfer(v_gym_id, member_id);
    delete from public.gym_members where gym_id = v_gym_id and user_id = outsider_id;

    -- ---------------------------------------------------------------------
    -- A-013: propose to a non-member of the gym errors with TRANSFER_INVALID.
    -- ---------------------------------------------------------------------
    begin
        perform public.propose_gym_transfer(v_gym_id, outsider_id);
        raise exception 'A-013 FAIL: expected TRANSFER_INVALID, no exception raised';
    exception
        when others then
            v_caught_msg := sqlerrm;
            if position('TRANSFER_INVALID' in v_caught_msg) <> 1 then
                raise exception
                    'A-013 FAIL: expected TRANSFER_INVALID prefix, got: %', v_caught_msg;
            end if;
    end;
    raise notice 'A-013 OK: propose to non-member errors TRANSFER_INVALID';

    -- The pending row from the earlier propose to member_id should still exist.
    select count(*) into v_pending_count
    from public.gym_ownership_transfers
    where gym_id = v_gym_id and proposed_to = member_id;
    if v_pending_count <> 1 then
        raise exception
            'A-013 FAIL: prior pending row should still exist, count=%', v_pending_count;
    end if;

    -- ---------------------------------------------------------------------
    -- A-013a: accept_gym_transfer flips gyms.owner_user_id to the recipient
    -- and deletes the transfer row.
    -- ---------------------------------------------------------------------
    perform set_config('request.jwt.claim.sub', member_id::text, true);
    perform set_config('request.jwt.claims',
        json_build_object('sub', member_id::text)::text, true);

    perform public.accept_gym_transfer(v_gym_id);

    select owner_user_id into v_owner_after from public.gyms where id = v_gym_id;
    if v_owner_after <> member_id then
        raise exception
            'A-013a FAIL: expected owner_user_id=%, got %', member_id, v_owner_after;
    end if;

    select count(*) into v_pending_count
    from public.gym_ownership_transfers where gym_id = v_gym_id;
    if v_pending_count <> 0 then
        raise exception
            'A-013a FAIL: expected pending row deleted, got count=%', v_pending_count;
    end if;
    raise notice 'A-013a OK: accept flips owner and clears pending row';

    -- ---------------------------------------------------------------------
    -- A-013b (part 1): proposer can call cancel_or_decline_gym_transfer.
    --
    -- New owner is member_id. Re-add owner_id as a member so member_id can
    -- propose a transfer back. Then proposer (member_id) cancels.
    -- ---------------------------------------------------------------------
    insert into public.gym_members (gym_id, user_id)
    values (v_gym_id, owner_id)
    on conflict do nothing;

    -- caller = member_id (the new owner) proposes back to owner_id
    perform public.propose_gym_transfer(v_gym_id, owner_id);

    -- proposer cancels
    perform public.cancel_or_decline_gym_transfer(v_gym_id);

    select count(*) into v_pending_count
    from public.gym_ownership_transfers where gym_id = v_gym_id;
    if v_pending_count <> 0 then
        raise exception
            'A-013b FAIL (proposer cancel): expected 0 pending, got %', v_pending_count;
    end if;
    raise notice 'A-013b OK: proposer can cancel pending transfer';

    -- ---------------------------------------------------------------------
    -- A-013b (part 2): target can also call cancel_or_decline_gym_transfer.
    -- ---------------------------------------------------------------------
    -- Re-propose so we have a fresh pending row for the target to decline.
    perform public.propose_gym_transfer(v_gym_id, owner_id);

    -- Switch caller to the target (owner_id) and decline.
    perform set_config('request.jwt.claim.sub', owner_id::text, true);
    perform set_config('request.jwt.claims',
        json_build_object('sub', owner_id::text)::text, true);

    perform public.cancel_or_decline_gym_transfer(v_gym_id);

    select count(*) into v_pending_count
    from public.gym_ownership_transfers where gym_id = v_gym_id;
    if v_pending_count <> 0 then
        raise exception
            'A-013b FAIL (target decline): expected 0 pending, got %', v_pending_count;
    end if;

    -- And the gym owner should still be member_id (decline must NOT flip ownership).
    select owner_user_id into v_owner_after from public.gyms where id = v_gym_id;
    if v_owner_after <> member_id then
        raise exception
            'A-013b FAIL: decline must not change owner (got %, expected %)',
            v_owner_after, member_id;
    end if;
    raise notice 'A-013b OK: target can decline pending transfer';

    raise notice '==========================================';
    raise notice 'F021 OWNERSHIP TRANSFER TEST SUITE PASSED';
    raise notice '==========================================';
end$$;

rollback;
