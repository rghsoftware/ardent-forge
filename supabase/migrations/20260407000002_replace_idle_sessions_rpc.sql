-- =============================================================================
-- Migration: Replace get_display_idle_sessions RPC with gym-scoped variant
-- (F018 Gym-Scoped Displays)
--
-- Description: The previous RPC (added in 20260404000003_get_display_idle_sessions.sql)
-- filtered users by `up.display_visible = true`. With F018, the per-user opt-out
-- flag is gone -- gym membership is the new opt-in surface. The RPC now takes
-- a `p_gym_id uuid` parameter and joins `gym_members` to filter to that gym's
-- members.
--
-- The Edge Function will call this once per gym in the cron loop. Return type
-- and column names are unchanged so the Edge Function consumer needs no other
-- type wiring beyond passing the gym_id parameter.
-- =============================================================================

-- Drop both possible prior signatures defensively. The migration in
-- 20260404000003 created the no-arg version; the uuid-arg version is dropped
-- defensively in case a prior dev experiment ever defined it.
drop function if exists public.get_display_idle_sessions();
drop function if exists public.get_display_idle_sessions(uuid);

-- New signature: gym-scoped. Same return shape as the prior version so the
-- Edge Function row-mapping logic stays unchanged.
create function public.get_display_idle_sessions(p_gym_id uuid)
returns table (
    display_name text,
    session_name text,
    session_type text,
    day_label    text
)
language sql
security definer
stable
as $$
    select
        up.display_name,
        st.name as session_name,
        ss.session_type,
        ss.day_label
    from program_activations pa
    join programs p on p.id = pa.program_id
    join blocks b on b.program_id = p.id
        and b.ordinal = pa.current_block_ordinal
    join block_weeks bw on bw.block_id = b.id
        and bw.week_number = pa.current_week_number
    join scheduled_sessions ss on ss.block_week_id = bw.id
        and ss.day_of_week is not null
        and ss.day_of_week = extract(dow from now())
    join session_templates st on st.id = ss.session_template_id
    join user_profiles up on up.id = pa.user_id
    -- F018: filter by gym membership instead of display_visible.
    -- A user's scheduled session shows on a gym's TV iff they are a member
    -- of that gym.
    join gym_members gm on gm.user_id = pa.user_id
        and gm.gym_id = p_gym_id
    left join workout_logs wl on wl.session_template_id = ss.session_template_id
        and wl.user_id = pa.user_id
        and date(wl.started_at) = current_date
        and wl.completed_at is not null
    where wl.id is null
    order by up.display_name
    limit 3;
$$;

comment on function public.get_display_idle_sessions(uuid) is
    'F018: returns today''s remaining (not-yet-completed) scheduled sessions '
    'for members of a specific gym, ordered alphabetically. LIMIT 3 matches the '
    'remote display''s max visible session cards. Called once per gym per cron '
    'tick by the display-idle-snapshot Edge Function.';

-- Lock execution to service_role only (the Edge Function cron context).
revoke execute on function public.get_display_idle_sessions(uuid) from public;
revoke execute on function public.get_display_idle_sessions(uuid) from anon;
revoke execute on function public.get_display_idle_sessions(uuid) from authenticated;
grant  execute on function public.get_display_idle_sessions(uuid) to service_role;
