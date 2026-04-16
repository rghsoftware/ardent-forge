CREATE OR REPLACE FUNCTION get_frequent_exercise_ids(
  uid        uuid,
  lim        int  DEFAULT 8,
  window_days int DEFAULT 90
)
RETURNS TABLE(exercise_id uuid, set_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    la.exercise_id,
    COUNT(ls.id) AS set_count
  FROM logged_activities la
  JOIN logged_activity_groups lag ON la.logged_group_id = lag.id
  JOIN workout_logs wl ON lag.workout_log_id = wl.id
  LEFT JOIN logged_sets ls
    ON ls.logged_activity_id = la.id
    AND ls.completed = true
  WHERE wl.user_id = uid
    AND wl.started_at >= (NOW() - make_interval(days => window_days))
  GROUP BY la.exercise_id
  ORDER BY set_count DESC
  LIMIT lim;
$$;
