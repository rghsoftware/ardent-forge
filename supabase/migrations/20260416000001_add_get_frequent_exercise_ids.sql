CREATE OR REPLACE FUNCTION get_frequent_exercise_ids(
  uid        uuid,
  lim        int  DEFAULT 8,
  window_days int DEFAULT 90
)
RETURNS TABLE(exercise_id uuid, set_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select
    la.exercise_id,
    count(ls.id) as set_count
  from logged_activities la
  join logged_activity_groups lag on la.logged_group_id = lag.id
  join workout_logs wl on lag.workout_log_id = wl.id
  left join logged_sets ls
    on ls.logged_activity_id = la.id
    and ls.completed = true
  where wl.user_id = uid
    and wl.started_at >= (now() - make_interval(days => window_days))
  group by la.exercise_id
  having count(ls.id) > 0
  order by set_count desc
  limit lim;
$$;
