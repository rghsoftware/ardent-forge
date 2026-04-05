-- RPC function for the display-idle-snapshot Edge Function.
-- Returns today's remaining (not-yet-completed) scheduled sessions
-- for all display-visible users, ordered alphabetically.
-- LIMIT 3: matches the remote display's max visible session cards.

drop function if exists get_display_idle_sessions();

create function get_display_idle_sessions()
returns table (
  display_name text,
  session_name text,
  session_type text,
  day_label text
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
  left join workout_logs wl on wl.session_template_id = ss.session_template_id
    and wl.user_id = pa.user_id
    and date(wl.started_at) = current_date
    and wl.completed_at is not null
  where up.display_visible = true
    and wl.id is null
  order by up.display_name
  limit 3;
$$;

-- Index for the workout_logs LEFT JOIN (runs every minute via cron)
create index if not exists idx_workout_logs_session_user_date
  on workout_logs (session_template_id, user_id, started_at, completed_at);

-- Only service_role should call this function (Edge Function cron)
revoke execute on function get_display_idle_sessions() from public;
revoke execute on function get_display_idle_sessions() from anon;
revoke execute on function get_display_idle_sessions() from authenticated;
grant execute on function get_display_idle_sessions() to service_role;
