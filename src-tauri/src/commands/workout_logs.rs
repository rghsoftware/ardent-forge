use std::collections::HashMap;

use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::models::{
    LoggedActivityGroupResponse, LoggedActivityGroupRow, LoggedActivityResponse, LoggedActivityRow,
    LoggedSetResponse, LoggedSetRow, WorkoutLogFull, WorkoutLogResponse, WorkoutLogRow,
    WorkoutLogSummary, WorkoutWithSets,
};
use crate::utils::now_unix;

// ---------------------------------------------------------------------------
// Input structs
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
pub struct CreateWorkoutLogInput {
    pub user_id: String,
    pub title: Option<String>,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub session_template_id: Option<String>,
    pub program_context: Option<String>,
    pub overall_notes: Option<String>,
    pub perceived_difficulty: Option<i32>,
    pub bodyweight_at_session: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct CreateLoggedActivityGroupInput {
    pub workout_log_id: String,
    pub group_type: String,
    pub ordinal: i32,
    pub actual_rounds_completed: Option<i32>,
    pub completion_time: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct CreateLoggedActivityInput {
    pub logged_group_id: String,
    pub exercise_id: String,
    pub ordinal: i32,
    pub notes: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct CreateLoggedSetInput {
    pub logged_activity_id: String,
    pub set_number: i32,
    pub set_type: String,
    pub prescribed: Option<String>,
    pub actual_reps: Option<i32>,
    pub actual_weight: Option<String>,
    pub actual_duration: Option<String>,
    pub actual_distance: Option<String>,
    pub actual_pace: Option<String>,
    pub actual_heart_rate: Option<i32>,
    pub ruck_load: Option<String>,
    pub elevation_gain: Option<String>,
    pub rpe: Option<i32>,
    pub completed: Option<bool>,
    pub notes: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct UpdateLoggedSetInput {
    pub id: String,
    pub logged_activity_id: String,
    pub set_number: i32,
    pub set_type: String,
    pub prescribed: Option<String>,
    pub actual_reps: Option<i32>,
    pub actual_weight: Option<String>,
    pub actual_duration: Option<String>,
    pub actual_distance: Option<String>,
    pub actual_pace: Option<String>,
    pub actual_heart_rate: Option<i32>,
    pub ruck_load: Option<String>,
    pub elevation_gain: Option<String>,
    pub rpe: Option<i32>,
    pub completed: Option<bool>,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_workout_logs(
    pool: State<'_, SqlitePool>,
    user_id: String,
    limit: Option<i64>,
) -> Result<Vec<WorkoutLogResponse>, String> {
    let lim = limit.unwrap_or(50);
    let rows = sqlx::query_as::<_, WorkoutLogRow>(
        "SELECT * FROM workout_logs WHERE user_id = ? ORDER BY started_at DESC LIMIT ?",
    )
    .bind(&user_id)
    .bind(lim)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(WorkoutLogResponse::from).collect())
}

#[tauri::command]
pub async fn get_workout_logs_summary(
    pool: State<'_, SqlitePool>,
    user_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<WorkoutLogSummary>, String> {
    let lim = limit.unwrap_or(50);
    let off = offset.unwrap_or(0);

    // Fetch completed workout logs
    let logs = sqlx::query_as::<_, WorkoutLogRow>(
        "SELECT * FROM workout_logs \
         WHERE user_id = ? AND completed_at IS NOT NULL \
         ORDER BY started_at DESC LIMIT ? OFFSET ?",
    )
    .bind(&user_id)
    .bind(lim)
    .bind(off)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if logs.is_empty() {
        return Ok(Vec::new());
    }

    let log_ids: Vec<String> = logs.iter().map(|l| l.id.clone()).collect();

    // Build placeholders for IN clause
    let placeholders = log_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");

    // Fetch aggregated data per workout: exercise names and set counts
    // Using a multi-table join to get exercise names and completed set counts
    let agg_sql = format!(
        "SELECT \
            wl.id AS workout_log_id, \
            e.name AS exercise_name, \
            COUNT(CASE WHEN ls.completed = 1 THEN 1 END) AS completed_sets \
         FROM workout_logs wl \
         JOIN logged_activity_groups lag ON lag.workout_log_id = wl.id \
         JOIN logged_activities la ON la.logged_group_id = lag.id \
         JOIN exercises e ON e.id = la.exercise_id \
         LEFT JOIN logged_sets ls ON ls.logged_activity_id = la.id \
         WHERE wl.id IN ({placeholders}) \
         GROUP BY wl.id, e.name \
         ORDER BY wl.id"
    );

    #[derive(sqlx::FromRow)]
    struct AggRow {
        workout_log_id: String,
        exercise_name: String,
        completed_sets: i64,
    }

    let mut query = sqlx::query_as::<_, AggRow>(&agg_sql);
    for id in &log_ids {
        query = query.bind(id);
    }
    let agg_rows = query.fetch_all(pool.inner()).await.map_err(|e| e.to_string())?;

    // Build a map: workout_log_id -> (exercise_names, set_count)
    let mut agg_map: HashMap<String, (Vec<String>, i64)> = HashMap::new();
    for row in agg_rows {
        let entry = agg_map.entry(row.workout_log_id.clone()).or_insert_with(|| (Vec::new(), 0));
        entry.0.push(row.exercise_name);
        entry.1 += row.completed_sets;
    }

    let summaries = logs
        .into_iter()
        .map(|log| {
            let (exercise_names, set_count) = agg_map
                .remove(&log.id)
                .unwrap_or_else(|| (Vec::new(), 0));
            let exercise_count = exercise_names.len() as i64;
            WorkoutLogSummary {
                log: WorkoutLogResponse::from(log),
                exercise_names,
                set_count,
                exercise_count,
            }
        })
        .collect();

    Ok(summaries)
}

#[tauri::command]
pub async fn get_workout_log(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<WorkoutLogResponse>, String> {
    let row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(row.map(WorkoutLogResponse::from))
}

#[tauri::command]
pub async fn get_workout_log_full(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<WorkoutLogFull>, String> {
    // Fetch the workout log
    let log_row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    let log_row = match log_row {
        Some(r) => r,
        None => return Ok(None),
    };

    // Fetch groups
    let group_rows = sqlx::query_as::<_, LoggedActivityGroupRow>(
        "SELECT * FROM logged_activity_groups WHERE workout_log_id = ? ORDER BY ordinal",
    )
    .bind(&id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let group_ids: Vec<String> = group_rows.iter().map(|g| g.id.clone()).collect();

    if group_ids.is_empty() {
        return Ok(Some(WorkoutLogFull {
            log: WorkoutLogResponse::from(log_row),
            groups: Vec::new(),
            activities: Vec::new(),
            sets: Vec::new(),
        }));
    }

    // Fetch activities for all groups
    let act_placeholders = group_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let act_sql = format!(
        "SELECT * FROM logged_activities WHERE logged_group_id IN ({act_placeholders}) ORDER BY ordinal"
    );
    let mut act_query = sqlx::query_as::<_, LoggedActivityRow>(&act_sql);
    for gid in &group_ids {
        act_query = act_query.bind(gid);
    }
    let act_rows = act_query.fetch_all(pool.inner()).await.map_err(|e| e.to_string())?;

    let activity_ids: Vec<String> = act_rows.iter().map(|a| a.id.clone()).collect();

    if activity_ids.is_empty() {
        return Ok(Some(WorkoutLogFull {
            log: WorkoutLogResponse::from(log_row),
            groups: group_rows.into_iter().map(LoggedActivityGroupResponse::from).collect(),
            activities: Vec::new(),
            sets: Vec::new(),
        }));
    }

    // Fetch sets for all activities
    let set_placeholders = activity_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let set_sql = format!(
        "SELECT * FROM logged_sets WHERE logged_activity_id IN ({set_placeholders}) ORDER BY set_number"
    );
    let mut set_query = sqlx::query_as::<_, LoggedSetRow>(&set_sql);
    for aid in &activity_ids {
        set_query = set_query.bind(aid);
    }
    let set_rows = set_query.fetch_all(pool.inner()).await.map_err(|e| e.to_string())?;

    Ok(Some(WorkoutLogFull {
        log: WorkoutLogResponse::from(log_row),
        groups: group_rows.into_iter().map(LoggedActivityGroupResponse::from).collect(),
        activities: act_rows.into_iter().map(LoggedActivityResponse::from).collect(),
        sets: set_rows.into_iter().map(LoggedSetResponse::from).collect(),
    }))
}

#[tauri::command]
pub async fn create_workout_log(
    pool: State<'_, SqlitePool>,
    log: CreateWorkoutLogInput,
) -> Result<WorkoutLogResponse, String> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();

    sqlx::query(
        "INSERT INTO workout_logs \
         (id, user_id, title, started_at, completed_at, session_template_id, \
          program_context, overall_notes, perceived_difficulty, bodyweight_at_session, \
          created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&log.user_id)
    .bind(&log.title)
    .bind(log.started_at)
    .bind(log.completed_at)
    .bind(&log.session_template_id)
    .bind(&log.program_context)
    .bind(&log.overall_notes)
    .bind(log.perceived_difficulty)
    .bind(&log.bodyweight_at_session)
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(WorkoutLogResponse::from(row))
}

#[tauri::command]
pub async fn update_workout_log(
    pool: State<'_, SqlitePool>,
    id: String,
    title: Option<String>,
    completed_at: Option<i64>,
    overall_notes: Option<String>,
    perceived_difficulty: Option<i32>,
) -> Result<WorkoutLogResponse, String> {
    let now = now_unix();

    sqlx::query(
        "UPDATE workout_logs SET \
         title = COALESCE(?, title), \
         completed_at = COALESCE(?, completed_at), \
         overall_notes = COALESCE(?, overall_notes), \
         perceived_difficulty = COALESCE(?, perceived_difficulty), \
         updated_at = ? \
         WHERE id = ?",
    )
    .bind(&title)
    .bind(completed_at)
    .bind(&overall_notes)
    .bind(perceived_difficulty)
    .bind(now)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(WorkoutLogResponse::from(row))
}

#[tauri::command]
pub async fn delete_workout_log(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), String> {
    // ON DELETE CASCADE handles child rows (groups -> activities -> sets)
    sqlx::query("DELETE FROM workout_logs WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn create_logged_activity_group(
    pool: State<'_, SqlitePool>,
    group: CreateLoggedActivityGroupInput,
    user_id: String,
) -> Result<LoggedActivityGroupResponse, String> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();

    sqlx::query(
        "INSERT INTO logged_activity_groups \
         (id, workout_log_id, user_id, group_type, ordinal, actual_rounds_completed, \
          completion_time, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&group.workout_log_id)
    .bind(&user_id)
    .bind(&group.group_type)
    .bind(group.ordinal)
    .bind(group.actual_rounds_completed)
    .bind(&group.completion_time)
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query_as::<_, LoggedActivityGroupRow>(
        "SELECT * FROM logged_activity_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(LoggedActivityGroupResponse::from(row))
}

#[tauri::command]
pub async fn create_logged_activity(
    pool: State<'_, SqlitePool>,
    activity: CreateLoggedActivityInput,
    user_id: String,
) -> Result<LoggedActivityResponse, String> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();

    sqlx::query(
        "INSERT INTO logged_activities \
         (id, logged_group_id, user_id, exercise_id, ordinal, notes, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&activity.logged_group_id)
    .bind(&user_id)
    .bind(&activity.exercise_id)
    .bind(activity.ordinal)
    .bind(&activity.notes)
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let row =
        sqlx::query_as::<_, LoggedActivityRow>("SELECT * FROM logged_activities WHERE id = ?")
            .bind(&id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    Ok(LoggedActivityResponse::from(row))
}

#[tauri::command]
pub async fn create_logged_set(
    pool: State<'_, SqlitePool>,
    set: CreateLoggedSetInput,
    user_id: String,
) -> Result<LoggedSetResponse, String> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();
    let completed = set.completed.map(|b| if b { 1i32 } else { 0 });

    sqlx::query(
        "INSERT INTO logged_sets \
         (id, logged_activity_id, user_id, set_number, set_type, prescribed, \
          actual_reps, actual_weight, actual_duration, actual_distance, actual_pace, \
          actual_heart_rate, ruck_load, elevation_gain, rpe, completed, notes, \
          created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&set.logged_activity_id)
    .bind(&user_id)
    .bind(set.set_number)
    .bind(&set.set_type)
    .bind(&set.prescribed)
    .bind(set.actual_reps)
    .bind(&set.actual_weight)
    .bind(&set.actual_duration)
    .bind(&set.actual_distance)
    .bind(&set.actual_pace)
    .bind(set.actual_heart_rate)
    .bind(&set.ruck_load)
    .bind(&set.elevation_gain)
    .bind(set.rpe)
    .bind(completed)
    .bind(&set.notes)
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query_as::<_, LoggedSetRow>("SELECT * FROM logged_sets WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(LoggedSetResponse::from(row))
}

#[tauri::command]
pub async fn update_logged_set(
    pool: State<'_, SqlitePool>,
    set: UpdateLoggedSetInput,
    user_id: String,
) -> Result<LoggedSetResponse, String> {
    let now = now_unix();
    let completed = set.completed.map(|b| if b { 1i32 } else { 0 });

    sqlx::query(
        "UPDATE logged_sets SET \
         logged_activity_id = ?, user_id = ?, set_number = ?, set_type = ?, \
         prescribed = ?, actual_reps = ?, actual_weight = ?, actual_duration = ?, \
         actual_distance = ?, actual_pace = ?, actual_heart_rate = ?, ruck_load = ?, \
         elevation_gain = ?, rpe = ?, completed = ?, notes = ?, updated_at = ? \
         WHERE id = ?",
    )
    .bind(&set.logged_activity_id)
    .bind(&user_id)
    .bind(set.set_number)
    .bind(&set.set_type)
    .bind(&set.prescribed)
    .bind(set.actual_reps)
    .bind(&set.actual_weight)
    .bind(&set.actual_duration)
    .bind(&set.actual_distance)
    .bind(&set.actual_pace)
    .bind(set.actual_heart_rate)
    .bind(&set.ruck_load)
    .bind(&set.elevation_gain)
    .bind(set.rpe)
    .bind(completed)
    .bind(&set.notes)
    .bind(now)
    .bind(&set.id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query_as::<_, LoggedSetRow>("SELECT * FROM logged_sets WHERE id = ?")
        .bind(&set.id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(LoggedSetResponse::from(row))
}

#[tauri::command]
pub async fn get_recently_used_exercise_ids(
    pool: State<'_, SqlitePool>,
    user_id: String,
    limit: Option<i64>,
) -> Result<Vec<String>, String> {
    let lim = limit.unwrap_or(10);

    #[derive(sqlx::FromRow)]
    struct IdRow {
        exercise_id: String,
    }

    let rows = sqlx::query_as::<_, IdRow>(
        "SELECT la.exercise_id \
         FROM logged_activities la \
         JOIN logged_activity_groups lag ON lag.id = la.logged_group_id \
         JOIN workout_logs wl ON wl.id = lag.workout_log_id \
         WHERE wl.user_id = ? \
         GROUP BY la.exercise_id \
         ORDER BY MAX(wl.started_at) DESC \
         LIMIT ?",
    )
    .bind(&user_id)
    .bind(lim)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| r.exercise_id).collect())
}

#[tauri::command]
pub async fn get_exercise_workout_history(
    pool: State<'_, SqlitePool>,
    user_id: String,
    exercise_id: String,
    limit: Option<i64>,
) -> Result<Vec<WorkoutWithSets>, String> {
    let lim = limit.unwrap_or(10);

    // Find workout log IDs that contain this exercise, ordered by most recent
    #[derive(sqlx::FromRow)]
    struct LogIdRow {
        workout_log_id: String,
    }

    let log_id_rows = sqlx::query_as::<_, LogIdRow>(
        "SELECT DISTINCT lag.workout_log_id \
         FROM logged_activities la \
         JOIN logged_activity_groups lag ON lag.id = la.logged_group_id \
         JOIN workout_logs wl ON wl.id = lag.workout_log_id \
         WHERE la.exercise_id = ? AND wl.user_id = ? \
         ORDER BY wl.started_at DESC \
         LIMIT ?",
    )
    .bind(&exercise_id)
    .bind(&user_id)
    .bind(lim)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if log_id_rows.is_empty() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();

    for log_id_row in &log_id_rows {
        let wl_id = &log_id_row.workout_log_id;

        // Fetch the workout log
        let log_row =
            sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
                .bind(wl_id)
                .fetch_one(pool.inner())
                .await
                .map_err(|e| e.to_string())?;

        // Fetch sets for this exercise within this workout
        let set_rows = sqlx::query_as::<_, LoggedSetRow>(
            "SELECT ls.* FROM logged_sets ls \
             JOIN logged_activities la ON la.id = ls.logged_activity_id \
             JOIN logged_activity_groups lag ON lag.id = la.logged_group_id \
             WHERE lag.workout_log_id = ? AND la.exercise_id = ? \
             ORDER BY ls.set_number",
        )
        .bind(wl_id)
        .bind(&exercise_id)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        results.push(WorkoutWithSets {
            log: WorkoutLogResponse::from(log_row),
            sets: set_rows.into_iter().map(LoggedSetResponse::from).collect(),
        });
    }

    Ok(results)
}
