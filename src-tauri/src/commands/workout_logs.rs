use std::collections::HashMap;

use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    LoggedActivityGroupRow, LoggedActivityRow, LoggedSetRow, WorkoutLogFull, WorkoutLogRow,
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

#[derive(serde::Deserialize)]
pub struct CreateWorkoutLogFullInput {
    pub log: CreateWorkoutLogInput,
    pub groups: Vec<CreateLoggedActivityGroupFullInput>,
}

#[derive(serde::Deserialize)]
pub struct CreateLoggedActivityGroupFullInput {
    pub group: CreateLoggedActivityGroupInput,
    pub activities: Vec<CreateLoggedActivityFullInput>,
}

#[derive(serde::Deserialize)]
pub struct CreateLoggedActivityFullInput {
    pub activity: CreateLoggedActivityInput,
    pub sets: Vec<CreateLoggedSetInput>,
}

const VALID_SET_TYPES: &[&str] = &["WORKING", "WARMUP", "DROPSET", "BACKOFF", "FAILURE", "MAX"];

// ---------------------------------------------------------------------------
// Commands (thin wrappers delegating to inner functions for testability)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_workout_logs(
    pool: State<'_, SqlitePool>,
    user_id: String,
    limit: Option<i64>,
) -> Result<Vec<WorkoutLogRow>, AppError> {
    get_workout_logs_inner(pool.inner(), user_id, limit).await
}

#[tauri::command]
pub async fn get_workout_logs_summary(
    pool: State<'_, SqlitePool>,
    user_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<WorkoutLogSummary>, AppError> {
    get_workout_logs_summary_inner(pool.inner(), user_id, limit, offset).await
}

#[tauri::command]
pub async fn get_workout_log(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<WorkoutLogRow>, AppError> {
    get_workout_log_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn get_workout_log_full(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<WorkoutLogFull>, AppError> {
    get_workout_log_full_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn create_workout_log(
    pool: State<'_, SqlitePool>,
    log: CreateWorkoutLogInput,
) -> Result<WorkoutLogRow, AppError> {
    create_workout_log_inner(pool.inner(), log).await
}

#[tauri::command]
pub async fn update_workout_log(
    pool: State<'_, SqlitePool>,
    id: String,
    title: Option<String>,
    completed_at: Option<i64>,
    overall_notes: Option<String>,
    perceived_difficulty: Option<i32>,
) -> Result<WorkoutLogRow, AppError> {
    update_workout_log_inner(
        pool.inner(),
        id,
        title,
        completed_at,
        overall_notes,
        perceived_difficulty,
    )
    .await
}

#[tauri::command]
pub async fn delete_workout_log(pool: State<'_, SqlitePool>, id: String) -> Result<(), AppError> {
    delete_workout_log_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn create_logged_activity_group(
    pool: State<'_, SqlitePool>,
    group: CreateLoggedActivityGroupInput,
    user_id: String,
) -> Result<LoggedActivityGroupRow, AppError> {
    create_logged_activity_group_inner(pool.inner(), group, user_id).await
}

#[tauri::command]
pub async fn create_logged_activity(
    pool: State<'_, SqlitePool>,
    activity: CreateLoggedActivityInput,
    user_id: String,
) -> Result<LoggedActivityRow, AppError> {
    create_logged_activity_inner(pool.inner(), activity, user_id).await
}

#[tauri::command]
pub async fn create_logged_set(
    pool: State<'_, SqlitePool>,
    set: CreateLoggedSetInput,
    user_id: String,
) -> Result<LoggedSetRow, AppError> {
    create_logged_set_inner(pool.inner(), set, user_id).await
}

#[tauri::command]
pub async fn update_logged_set(
    pool: State<'_, SqlitePool>,
    set: UpdateLoggedSetInput,
    user_id: String,
) -> Result<LoggedSetRow, AppError> {
    update_logged_set_inner(pool.inner(), set, user_id).await
}

#[tauri::command]
pub async fn get_recently_used_exercise_ids(
    pool: State<'_, SqlitePool>,
    user_id: String,
    limit: Option<i64>,
) -> Result<Vec<String>, AppError> {
    get_recently_used_exercise_ids_inner(pool.inner(), user_id, limit).await
}

#[tauri::command]
pub async fn get_exercise_workout_history(
    pool: State<'_, SqlitePool>,
    user_id: String,
    exercise_id: String,
    limit: Option<i64>,
) -> Result<Vec<WorkoutWithSets>, AppError> {
    get_exercise_workout_history_inner(pool.inner(), user_id, exercise_id, limit).await
}

#[tauri::command]
pub async fn create_workout_log_full(
    pool: State<'_, SqlitePool>,
    input: CreateWorkoutLogFullInput,
    user_id: String,
) -> Result<WorkoutLogFull, AppError> {
    create_workout_log_full_inner(pool.inner(), input, user_id).await
}

// ---------------------------------------------------------------------------
// Inner functions (testable, take &SqlitePool directly)
// ---------------------------------------------------------------------------

pub(crate) async fn get_workout_logs_inner(
    pool: &SqlitePool,
    user_id: String,
    limit: Option<i64>,
) -> Result<Vec<WorkoutLogRow>, AppError> {
    let lim = limit.unwrap_or(50);
    let rows = sqlx::query_as::<_, WorkoutLogRow>(
        "SELECT * FROM workout_logs WHERE user_id = ? ORDER BY started_at DESC LIMIT ?",
    )
    .bind(&user_id)
    .bind(lim)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub(crate) async fn get_workout_logs_summary_inner(
    pool: &SqlitePool,
    user_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<WorkoutLogSummary>, AppError> {
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
    .fetch_all(pool)
    .await?;

    if logs.is_empty() {
        return Ok(Vec::new());
    }

    let log_ids: Vec<String> = logs.iter().map(|l| l.id.clone()).collect();

    // Build placeholders for IN clause
    let placeholders = log_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");

    // Fetch aggregated data per workout: exercise names and set counts
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
    let agg_rows = query.fetch_all(pool).await?;

    // Build a map: workout_log_id -> (exercise_names, set_count)
    let mut agg_map: HashMap<String, (Vec<String>, i64)> = HashMap::new();
    for row in agg_rows {
        let entry = agg_map
            .entry(row.workout_log_id.clone())
            .or_insert_with(|| (Vec::new(), 0));
        entry.0.push(row.exercise_name);
        entry.1 += row.completed_sets;
    }

    let summaries = logs
        .into_iter()
        .map(|log| {
            let (exercise_names, set_count) =
                agg_map.remove(&log.id).unwrap_or_else(|| (Vec::new(), 0));
            let exercise_count = exercise_names.len() as i64;
            WorkoutLogSummary {
                log,
                exercise_names,
                set_count,
                exercise_count,
            }
        })
        .collect();

    Ok(summaries)
}

pub(crate) async fn get_workout_log_inner(
    pool: &SqlitePool,
    id: String,
) -> Result<Option<WorkoutLogRow>, AppError> {
    let row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool)
        .await?;

    Ok(row)
}

pub(crate) async fn get_workout_log_full_inner(
    pool: &SqlitePool,
    id: String,
) -> Result<Option<WorkoutLogFull>, AppError> {
    // Fetch the workout log
    let log_row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool)
        .await?;

    let log_row = match log_row {
        Some(r) => r,
        None => return Ok(None),
    };

    // Fetch groups
    let group_rows = sqlx::query_as::<_, LoggedActivityGroupRow>(
        "SELECT * FROM logged_activity_groups WHERE workout_log_id = ? ORDER BY ordinal",
    )
    .bind(&id)
    .fetch_all(pool)
    .await?;

    let group_ids: Vec<String> = group_rows.iter().map(|g| g.id.clone()).collect();

    if group_ids.is_empty() {
        return Ok(Some(WorkoutLogFull {
            log: log_row,
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
    let act_rows = act_query.fetch_all(pool).await?;

    let activity_ids: Vec<String> = act_rows.iter().map(|a| a.id.clone()).collect();

    if activity_ids.is_empty() {
        return Ok(Some(WorkoutLogFull {
            log: log_row,
            groups: group_rows,
            activities: Vec::new(),
            sets: Vec::new(),
        }));
    }

    // Fetch sets for all activities
    let set_placeholders = activity_ids
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(",");
    let set_sql = format!(
        "SELECT * FROM logged_sets WHERE logged_activity_id IN ({set_placeholders}) ORDER BY set_number"
    );
    let mut set_query = sqlx::query_as::<_, LoggedSetRow>(&set_sql);
    for aid in &activity_ids {
        set_query = set_query.bind(aid);
    }
    let set_rows = set_query.fetch_all(pool).await?;

    Ok(Some(WorkoutLogFull {
        log: log_row,
        groups: group_rows,
        activities: act_rows,
        sets: set_rows,
    }))
}

pub(crate) async fn create_workout_log_inner(
    pool: &SqlitePool,
    log: CreateWorkoutLogInput,
) -> Result<WorkoutLogRow, AppError> {
    // Validation
    if log.started_at <= 0 {
        return Err(AppError::validation(
            "started_at",
            "started_at must be a positive Unix timestamp",
        ));
    }
    if let Some(pd) = log.perceived_difficulty {
        if !(1..=10).contains(&pd) {
            return Err(AppError::validation("perceived_difficulty", "Must be 1-10"));
        }
    }

    let id = Uuid::new_v4().to_string();
    let now = now_unix();

    let mut tx = pool.begin().await?;

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
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(row)
}

pub(crate) async fn update_workout_log_inner(
    pool: &SqlitePool,
    id: String,
    title: Option<String>,
    completed_at: Option<i64>,
    overall_notes: Option<String>,
    perceived_difficulty: Option<i32>,
) -> Result<WorkoutLogRow, AppError> {
    let now = now_unix();

    let result = sqlx::query(
        "UPDATE workout_logs SET \
         title = ?, \
         completed_at = ?, \
         overall_notes = ?, \
         perceived_difficulty = ?, \
         updated_at = ? \
         WHERE id = ?",
    )
    .bind(&title)
    .bind(completed_at)
    .bind(&overall_notes)
    .bind(perceived_difficulty)
    .bind(now)
    .bind(&id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("WorkoutLog", &id));
    }

    let row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&id)
        .fetch_one(pool)
        .await?;

    Ok(row)
}

pub(crate) async fn delete_workout_log_inner(
    pool: &SqlitePool,
    id: String,
) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM workout_logs WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("WorkoutLog", &id));
    }
    Ok(())
}

pub(crate) async fn create_logged_activity_group_inner(
    pool: &SqlitePool,
    group: CreateLoggedActivityGroupInput,
    user_id: String,
) -> Result<LoggedActivityGroupRow, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();

    let mut tx = pool.begin().await?;

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
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, LoggedActivityGroupRow>(
        "SELECT * FROM logged_activity_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(row)
}

pub(crate) async fn create_logged_activity_inner(
    pool: &SqlitePool,
    activity: CreateLoggedActivityInput,
    user_id: String,
) -> Result<LoggedActivityRow, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();

    let mut tx = pool.begin().await?;

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
    .execute(&mut *tx)
    .await?;

    let row =
        sqlx::query_as::<_, LoggedActivityRow>("SELECT * FROM logged_activities WHERE id = ?")
            .bind(&id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;

    Ok(row)
}

pub(crate) async fn create_logged_set_inner(
    pool: &SqlitePool,
    set: CreateLoggedSetInput,
    user_id: String,
) -> Result<LoggedSetRow, AppError> {
    // Validation
    if set.set_number < 1 {
        return Err(AppError::validation("set_number", "Must be >= 1"));
    }
    if let Some(rpe) = set.rpe {
        if !(1..=10).contains(&rpe) {
            return Err(AppError::validation("rpe", "Must be 1-10"));
        }
    }
    if !VALID_SET_TYPES.contains(&set.set_type.as_str()) {
        return Err(AppError::validation(
            "set_type",
            &format!(
                "Invalid set_type: {}. Valid values: {:?}",
                set.set_type, VALID_SET_TYPES
            ),
        ));
    }

    let id = Uuid::new_v4().to_string();
    let now = now_unix();
    let completed = set.completed.map(|b| if b { 1i32 } else { 0 });

    let mut tx = pool.begin().await?;

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
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, LoggedSetRow>("SELECT * FROM logged_sets WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(row)
}

pub(crate) async fn update_logged_set_inner(
    pool: &SqlitePool,
    set: UpdateLoggedSetInput,
    user_id: String,
) -> Result<LoggedSetRow, AppError> {
    let now = now_unix();
    let completed = set.completed.map(|b| if b { 1i32 } else { 0 });

    let mut tx = pool.begin().await?;

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
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, LoggedSetRow>("SELECT * FROM logged_sets WHERE id = ?")
        .bind(&set.id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(row)
}

pub(crate) async fn get_recently_used_exercise_ids_inner(
    pool: &SqlitePool,
    user_id: String,
    limit: Option<i64>,
) -> Result<Vec<String>, AppError> {
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
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().map(|r| r.exercise_id).collect())
}

pub(crate) async fn get_exercise_workout_history_inner(
    pool: &SqlitePool,
    user_id: String,
    exercise_id: String,
    limit: Option<i64>,
) -> Result<Vec<WorkoutWithSets>, AppError> {
    let lim = limit.unwrap_or(10);

    // Step 1: Find workout log IDs (1 query)
    #[derive(sqlx::FromRow)]
    struct LogIdRow {
        workout_log_id: String,
    }

    let log_ids: Vec<String> = sqlx::query_as::<_, LogIdRow>(
        "SELECT DISTINCT lag.workout_log_id \
         FROM logged_activities la \
         JOIN logged_activity_groups lag ON lag.id = la.logged_group_id \
         JOIN workout_logs wl ON wl.id = lag.workout_log_id \
         WHERE la.exercise_id = ? AND wl.user_id = ? \
         ORDER BY wl.started_at DESC LIMIT ?",
    )
    .bind(&exercise_id)
    .bind(&user_id)
    .bind(lim)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| r.workout_log_id)
    .collect();

    if log_ids.is_empty() {
        return Ok(Vec::new());
    }

    // Step 2: Fetch all workout logs in one query
    let placeholders = log_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let logs_sql =
        format!("SELECT * FROM workout_logs WHERE id IN ({placeholders}) ORDER BY started_at DESC");
    let mut logs_query = sqlx::query_as::<_, WorkoutLogRow>(&logs_sql);
    for id in &log_ids {
        logs_query = logs_query.bind(id);
    }
    let logs = logs_query.fetch_all(pool).await?;

    // Step 3: Fetch all relevant sets in one query with workout_log_id tag
    #[derive(sqlx::FromRow)]
    struct FlatSetRow {
        id: String,
        logged_activity_id: String,
        user_id: Option<String>,
        set_number: i32,
        set_type: String,
        prescribed: Option<String>,
        actual_reps: Option<i32>,
        actual_weight: Option<String>,
        actual_duration: Option<String>,
        actual_distance: Option<String>,
        actual_pace: Option<String>,
        actual_heart_rate: Option<i32>,
        ruck_load: Option<String>,
        elevation_gain: Option<String>,
        rpe: Option<i32>,
        completed: Option<i32>,
        notes: Option<String>,
        created_at: Option<i64>,
        updated_at: Option<i64>,
        _wl_id: String,
    }

    let sets_sql = format!(
        "SELECT ls.*, lag.workout_log_id AS _wl_id FROM logged_sets ls \
         JOIN logged_activities la ON la.id = ls.logged_activity_id \
         JOIN logged_activity_groups lag ON lag.id = la.logged_group_id \
         WHERE lag.workout_log_id IN ({placeholders}) AND la.exercise_id = ? \
         ORDER BY ls.set_number"
    );
    let mut sets_query = sqlx::query_as::<_, FlatSetRow>(&sets_sql);
    for id in &log_ids {
        sets_query = sets_query.bind(id);
    }
    sets_query = sets_query.bind(&exercise_id);
    let flat_sets = sets_query.fetch_all(pool).await?;

    // Group sets by workout_log_id
    let mut sets_map: HashMap<String, Vec<LoggedSetRow>> = HashMap::new();
    for fs in flat_sets {
        let wl_id = fs._wl_id.clone();
        sets_map.entry(wl_id).or_default().push(LoggedSetRow {
            id: fs.id,
            logged_activity_id: fs.logged_activity_id,
            user_id: fs.user_id,
            set_number: fs.set_number,
            set_type: fs.set_type,
            prescribed: fs.prescribed,
            actual_reps: fs.actual_reps,
            actual_weight: fs.actual_weight,
            actual_duration: fs.actual_duration,
            actual_distance: fs.actual_distance,
            actual_pace: fs.actual_pace,
            actual_heart_rate: fs.actual_heart_rate,
            ruck_load: fs.ruck_load,
            elevation_gain: fs.elevation_gain,
            rpe: fs.rpe,
            completed: fs.completed,
            notes: fs.notes,
            created_at: fs.created_at,
            updated_at: fs.updated_at,
        });
    }

    let results = logs
        .into_iter()
        .map(|log| {
            let sets = sets_map.remove(&log.id).unwrap_or_default();
            WorkoutWithSets { log, sets }
        })
        .collect();

    Ok(results)
}

pub(crate) async fn create_workout_log_full_inner(
    pool: &SqlitePool,
    input: CreateWorkoutLogFullInput,
    user_id: String,
) -> Result<WorkoutLogFull, AppError> {
    // Validation
    if input.log.started_at <= 0 {
        return Err(AppError::validation(
            "started_at",
            "started_at must be a positive Unix timestamp",
        ));
    }

    let log_id = Uuid::new_v4().to_string();
    let now = now_unix();
    let mut tx = pool.begin().await?;

    // Insert workout log
    sqlx::query(
        "INSERT INTO workout_logs \
         (id, user_id, title, started_at, completed_at, session_template_id, \
          program_context, overall_notes, perceived_difficulty, bodyweight_at_session, \
          created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&log_id)
    .bind(&user_id)
    .bind(&input.log.title)
    .bind(input.log.started_at)
    .bind(input.log.completed_at)
    .bind(&input.log.session_template_id)
    .bind(&input.log.program_context)
    .bind(&input.log.overall_notes)
    .bind(input.log.perceived_difficulty)
    .bind(&input.log.bodyweight_at_session)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    let mut all_groups: Vec<LoggedActivityGroupRow> = Vec::new();
    let mut all_activities: Vec<LoggedActivityRow> = Vec::new();
    let mut all_sets: Vec<LoggedSetRow> = Vec::new();

    for group_input in &input.groups {
        let group_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO logged_activity_groups \
             (id, workout_log_id, user_id, group_type, ordinal, actual_rounds_completed, \
              completion_time, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&group_id)
        .bind(&log_id)
        .bind(&user_id)
        .bind(&group_input.group.group_type)
        .bind(group_input.group.ordinal)
        .bind(group_input.group.actual_rounds_completed)
        .bind(&group_input.group.completion_time)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        let group_row = sqlx::query_as::<_, LoggedActivityGroupRow>(
            "SELECT * FROM logged_activity_groups WHERE id = ?",
        )
        .bind(&group_id)
        .fetch_one(&mut *tx)
        .await?;
        all_groups.push(group_row);

        for act_input in &group_input.activities {
            let act_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO logged_activities \
                 (id, logged_group_id, user_id, exercise_id, ordinal, notes, created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&act_id)
            .bind(&group_id)
            .bind(&user_id)
            .bind(&act_input.activity.exercise_id)
            .bind(act_input.activity.ordinal)
            .bind(&act_input.activity.notes)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await?;

            let act_row = sqlx::query_as::<_, LoggedActivityRow>(
                "SELECT * FROM logged_activities WHERE id = ?",
            )
            .bind(&act_id)
            .fetch_one(&mut *tx)
            .await?;
            all_activities.push(act_row);

            for set_input in &act_input.sets {
                let set_id = Uuid::new_v4().to_string();
                let completed = set_input.completed.map(|b| if b { 1i32 } else { 0 });
                sqlx::query(
                    "INSERT INTO logged_sets \
                     (id, logged_activity_id, user_id, set_number, set_type, prescribed, \
                      actual_reps, actual_weight, actual_duration, actual_distance, actual_pace, \
                      actual_heart_rate, ruck_load, elevation_gain, rpe, completed, notes, \
                      created_at, updated_at) \
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(&set_id)
                .bind(&act_id)
                .bind(&user_id)
                .bind(set_input.set_number)
                .bind(&set_input.set_type)
                .bind(&set_input.prescribed)
                .bind(set_input.actual_reps)
                .bind(&set_input.actual_weight)
                .bind(&set_input.actual_duration)
                .bind(&set_input.actual_distance)
                .bind(&set_input.actual_pace)
                .bind(set_input.actual_heart_rate)
                .bind(&set_input.ruck_load)
                .bind(&set_input.elevation_gain)
                .bind(set_input.rpe)
                .bind(completed)
                .bind(&set_input.notes)
                .bind(now)
                .bind(now)
                .execute(&mut *tx)
                .await?;

                let set_row =
                    sqlx::query_as::<_, LoggedSetRow>("SELECT * FROM logged_sets WHERE id = ?")
                        .bind(&set_id)
                        .fetch_one(&mut *tx)
                        .await?;
                all_sets.push(set_row);
            }
        }
    }

    let log_row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&log_id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(WorkoutLogFull {
        log: log_row,
        groups: all_groups,
        activities: all_activities,
        sets: all_sets,
    })
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    const WORKOUT_DDL: &str = "\
        CREATE TABLE IF NOT EXISTS exercises (\
            id TEXT PRIMARY KEY, \
            name TEXT NOT NULL, \
            aliases TEXT, \
            category TEXT NOT NULL, \
            movement_pattern TEXT, \
            muscle_groups TEXT, \
            is_bilateral INTEGER, \
            supports_1rm INTEGER, \
            equipment_required TEXT, \
            is_custom INTEGER DEFAULT 0, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS workout_logs (\
            id TEXT PRIMARY KEY, \
            user_id TEXT, \
            title TEXT, \
            started_at INTEGER NOT NULL, \
            completed_at INTEGER, \
            session_template_id TEXT, \
            program_context TEXT, \
            overall_notes TEXT, \
            perceived_difficulty INTEGER, \
            bodyweight_at_session TEXT, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS logged_activity_groups (\
            id TEXT PRIMARY KEY, \
            workout_log_id TEXT NOT NULL, \
            user_id TEXT, \
            group_type TEXT NOT NULL, \
            ordinal INTEGER NOT NULL, \
            actual_rounds_completed INTEGER, \
            completion_time TEXT, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS logged_activities (\
            id TEXT PRIMARY KEY, \
            logged_group_id TEXT NOT NULL, \
            user_id TEXT, \
            exercise_id TEXT NOT NULL, \
            ordinal INTEGER NOT NULL, \
            notes TEXT, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS logged_sets (\
            id TEXT PRIMARY KEY, \
            logged_activity_id TEXT NOT NULL, \
            user_id TEXT, \
            set_number INTEGER NOT NULL, \
            set_type TEXT NOT NULL, \
            prescribed TEXT, \
            actual_reps INTEGER, \
            actual_weight TEXT, \
            actual_duration TEXT, \
            actual_distance TEXT, \
            actual_pace TEXT, \
            actual_heart_rate INTEGER, \
            ruck_load TEXT, \
            elevation_gain TEXT, \
            rpe INTEGER, \
            completed INTEGER, \
            notes TEXT, \
            created_at INTEGER, \
            updated_at INTEGER\
        );";

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("in-memory pool");

        for stmt in WORKOUT_DDL.split(';') {
            let trimmed = stmt.trim();
            if !trimmed.is_empty() {
                sqlx::query(trimmed)
                    .execute(&pool)
                    .await
                    .unwrap_or_else(|e| panic!("DDL failed: {e}\nSQL: {trimmed}"));
            }
        }

        pool
    }

    /// Seeds an exercise row for use in workout tests.
    async fn seed_exercise(pool: &SqlitePool, id: &str, name: &str) {
        sqlx::query(
            "INSERT INTO exercises (id, name, category, created_at, updated_at) \
             VALUES (?, ?, 'strength', 1000, 1000)",
        )
        .bind(id)
        .bind(name)
        .execute(pool)
        .await
        .expect("seed exercise");
    }

    /// Helper: creates a basic workout log and returns its id.
    async fn seed_workout_log(pool: &SqlitePool, user_id: &str, started_at: i64) -> String {
        let row = create_workout_log_inner(
            pool,
            CreateWorkoutLogInput {
                user_id: user_id.into(),
                title: Some("Test Workout".into()),
                started_at,
                completed_at: Some(started_at + 3600),
                session_template_id: None,
                program_context: None,
                overall_notes: None,
                perceived_difficulty: None,
                bodyweight_at_session: None,
            },
        )
        .await
        .expect("seed workout log");
        row.id
    }

    /// Helper: creates a full workout log with a group, activity, and set.
    /// Returns (log_id, group_id, activity_id, set_id).
    async fn seed_full_workout(pool: &SqlitePool) -> (String, String, String, String) {
        seed_exercise(pool, "ex-squat", "Back Squat").await;

        let result = create_workout_log_full_inner(
            pool,
            CreateWorkoutLogFullInput {
                log: CreateWorkoutLogInput {
                    user_id: "user-1".into(),
                    title: Some("Full Workout".into()),
                    started_at: 1_700_000_000,
                    completed_at: Some(1_700_003_600),
                    session_template_id: None,
                    program_context: None,
                    overall_notes: None,
                    perceived_difficulty: Some(7),
                    bodyweight_at_session: None,
                },
                groups: vec![CreateLoggedActivityGroupFullInput {
                    group: CreateLoggedActivityGroupInput {
                        workout_log_id: String::new(), // ignored by create_workout_log_full_inner
                        group_type: "STRAIGHT".into(),
                        ordinal: 0,
                        actual_rounds_completed: None,
                        completion_time: None,
                    },
                    activities: vec![CreateLoggedActivityFullInput {
                        activity: CreateLoggedActivityInput {
                            logged_group_id: String::new(), // ignored
                            exercise_id: "ex-squat".into(),
                            ordinal: 0,
                            notes: None,
                        },
                        sets: vec![CreateLoggedSetInput {
                            logged_activity_id: String::new(), // ignored
                            set_number: 1,
                            set_type: "WORKING".into(),
                            prescribed: None,
                            actual_reps: Some(5),
                            actual_weight: Some(r#"{"value":315,"unit":"lb"}"#.into()),
                            actual_duration: None,
                            actual_distance: None,
                            actual_pace: None,
                            actual_heart_rate: None,
                            ruck_load: None,
                            elevation_gain: None,
                            rpe: Some(8),
                            completed: Some(true),
                            notes: None,
                        }],
                    }],
                }],
            },
            "user-1".into(),
        )
        .await
        .expect("seed full workout");

        (
            result.log.id,
            result.groups[0].id.clone(),
            result.activities[0].id.clone(),
            result.sets[0].id.clone(),
        )
    }

    // -----------------------------------------------------------------------
    // get_workout_logs -- empty results
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_workout_logs_empty_for_unknown_user() {
        let pool = setup_test_db().await;

        let rows = get_workout_logs_inner(&pool, "nobody".into(), None)
            .await
            .unwrap();

        assert!(rows.is_empty());
    }

    // -----------------------------------------------------------------------
    // create_workout_log -- CRUD
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn create_workout_log_basic() {
        let pool = setup_test_db().await;

        let row = create_workout_log_inner(
            &pool,
            CreateWorkoutLogInput {
                user_id: "user-1".into(),
                title: Some("Morning Session".into()),
                started_at: 1_700_000_000,
                completed_at: None,
                session_template_id: None,
                program_context: None,
                overall_notes: None,
                perceived_difficulty: None,
                bodyweight_at_session: None,
            },
        )
        .await
        .unwrap();

        assert_eq!(row.user_id, Some("user-1".into()));
        assert_eq!(row.title, Some("Morning Session".into()));
        assert_eq!(row.started_at, 1_700_000_000);
        assert!(row.completed_at.is_none());
    }

    #[tokio::test]
    async fn create_workout_log_rejects_invalid_started_at() {
        let pool = setup_test_db().await;

        let err = create_workout_log_inner(
            &pool,
            CreateWorkoutLogInput {
                user_id: "user-1".into(),
                title: None,
                started_at: 0,
                completed_at: None,
                session_template_id: None,
                program_context: None,
                overall_notes: None,
                perceived_difficulty: None,
                bodyweight_at_session: None,
            },
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("started_at"));
    }

    #[tokio::test]
    async fn create_workout_log_rejects_invalid_perceived_difficulty() {
        let pool = setup_test_db().await;

        let err = create_workout_log_inner(
            &pool,
            CreateWorkoutLogInput {
                user_id: "user-1".into(),
                title: None,
                started_at: 1_700_000_000,
                completed_at: None,
                session_template_id: None,
                program_context: None,
                overall_notes: None,
                perceived_difficulty: Some(11),
                bodyweight_at_session: None,
            },
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("1-10"));
    }

    // -----------------------------------------------------------------------
    // update_workout_log
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn update_workout_log_modifies_fields() {
        let pool = setup_test_db().await;
        let log_id = seed_workout_log(&pool, "user-1", 1_700_000_000).await;

        let updated = update_workout_log_inner(
            &pool,
            log_id.clone(),
            Some("Renamed".into()),
            Some(1_700_003_600),
            Some("Great session".into()),
            Some(8),
        )
        .await
        .unwrap();

        assert_eq!(updated.title, Some("Renamed".into()));
        assert_eq!(updated.completed_at, Some(1_700_003_600));
        assert_eq!(updated.overall_notes, Some("Great session".into()));
        assert_eq!(updated.perceived_difficulty, Some(8));
    }

    #[tokio::test]
    async fn update_workout_log_not_found() {
        let pool = setup_test_db().await;

        let err = update_workout_log_inner(&pool, "nonexistent".into(), None, None, None, None)
            .await
            .unwrap_err();

        assert!(err.message.contains("not found"));
    }

    // -----------------------------------------------------------------------
    // delete_workout_log
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn delete_workout_log_removes_row() {
        let pool = setup_test_db().await;
        let log_id = seed_workout_log(&pool, "user-1", 1_700_000_000).await;

        delete_workout_log_inner(&pool, log_id.clone())
            .await
            .unwrap();

        let fetched = get_workout_log_inner(&pool, log_id).await.unwrap();
        assert!(fetched.is_none());
    }

    #[tokio::test]
    async fn delete_workout_log_not_found() {
        let pool = setup_test_db().await;

        let err = delete_workout_log_inner(&pool, "nonexistent".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("not found"));
    }

    // -----------------------------------------------------------------------
    // get_workout_log / get_workout_log_full -- assembly
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_workout_log_returns_none_for_missing() {
        let pool = setup_test_db().await;

        let result = get_workout_log_inner(&pool, "nonexistent".into())
            .await
            .unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn get_workout_log_full_assembles_nested_data() {
        let pool = setup_test_db().await;
        let (log_id, _, _, _) = seed_full_workout(&pool).await;

        let full = get_workout_log_full_inner(&pool, log_id)
            .await
            .unwrap()
            .expect("should find full log");

        assert_eq!(full.groups.len(), 1);
        assert_eq!(full.activities.len(), 1);
        assert_eq!(full.sets.len(), 1);
        assert_eq!(full.sets[0].actual_reps, Some(5));
        assert_eq!(full.sets[0].rpe, Some(8));
        assert_eq!(full.sets[0].completed, Some(1));
    }

    #[tokio::test]
    async fn get_workout_log_full_returns_none_for_missing() {
        let pool = setup_test_db().await;

        let result = get_workout_log_full_inner(&pool, "nonexistent".into())
            .await
            .unwrap();

        assert!(result.is_none());
    }

    // -----------------------------------------------------------------------
    // create_logged_set -- validation
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn create_logged_set_rejects_invalid_set_type() {
        let pool = setup_test_db().await;

        let err = create_logged_set_inner(
            &pool,
            CreateLoggedSetInput {
                logged_activity_id: "act-1".into(),
                set_number: 1,
                set_type: "INVALID".into(),
                prescribed: None,
                actual_reps: None,
                actual_weight: None,
                actual_duration: None,
                actual_distance: None,
                actual_pace: None,
                actual_heart_rate: None,
                ruck_load: None,
                elevation_gain: None,
                rpe: None,
                completed: None,
                notes: None,
            },
            "user-1".into(),
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("Invalid set_type"));
    }

    #[tokio::test]
    async fn create_logged_set_rejects_invalid_set_number() {
        let pool = setup_test_db().await;

        let err = create_logged_set_inner(
            &pool,
            CreateLoggedSetInput {
                logged_activity_id: "act-1".into(),
                set_number: 0,
                set_type: "WORKING".into(),
                prescribed: None,
                actual_reps: None,
                actual_weight: None,
                actual_duration: None,
                actual_distance: None,
                actual_pace: None,
                actual_heart_rate: None,
                ruck_load: None,
                elevation_gain: None,
                rpe: None,
                completed: None,
                notes: None,
            },
            "user-1".into(),
        )
        .await
        .unwrap_err();

        assert!(err.message.contains(">= 1"));
    }

    #[tokio::test]
    async fn create_logged_set_rejects_invalid_rpe() {
        let pool = setup_test_db().await;

        let err = create_logged_set_inner(
            &pool,
            CreateLoggedSetInput {
                logged_activity_id: "act-1".into(),
                set_number: 1,
                set_type: "WORKING".into(),
                prescribed: None,
                actual_reps: None,
                actual_weight: None,
                actual_duration: None,
                actual_distance: None,
                actual_pace: None,
                actual_heart_rate: None,
                ruck_load: None,
                elevation_gain: None,
                rpe: Some(11),
                completed: None,
                notes: None,
            },
            "user-1".into(),
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("1-10"));
    }

    // -----------------------------------------------------------------------
    // create_workout_log_full -- full nested create
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn create_workout_log_full_creates_nested_entities() {
        let pool = setup_test_db().await;
        seed_exercise(&pool, "ex-bench", "Bench Press").await;

        let result = create_workout_log_full_inner(
            &pool,
            CreateWorkoutLogFullInput {
                log: CreateWorkoutLogInput {
                    user_id: "user-1".into(),
                    title: Some("Chest Day".into()),
                    started_at: 1_700_000_000,
                    completed_at: Some(1_700_003_600),
                    session_template_id: None,
                    program_context: None,
                    overall_notes: None,
                    perceived_difficulty: Some(6),
                    bodyweight_at_session: None,
                },
                groups: vec![CreateLoggedActivityGroupFullInput {
                    group: CreateLoggedActivityGroupInput {
                        workout_log_id: String::new(),
                        group_type: "STRAIGHT".into(),
                        ordinal: 0,
                        actual_rounds_completed: None,
                        completion_time: None,
                    },
                    activities: vec![CreateLoggedActivityFullInput {
                        activity: CreateLoggedActivityInput {
                            logged_group_id: String::new(),
                            exercise_id: "ex-bench".into(),
                            ordinal: 0,
                            notes: Some("Felt strong".into()),
                        },
                        sets: vec![
                            CreateLoggedSetInput {
                                logged_activity_id: String::new(),
                                set_number: 1,
                                set_type: "WORKING".into(),
                                prescribed: None,
                                actual_reps: Some(8),
                                actual_weight: Some(r#"{"value":225,"unit":"lb"}"#.into()),
                                actual_duration: None,
                                actual_distance: None,
                                actual_pace: None,
                                actual_heart_rate: None,
                                ruck_load: None,
                                elevation_gain: None,
                                rpe: Some(7),
                                completed: Some(true),
                                notes: None,
                            },
                            CreateLoggedSetInput {
                                logged_activity_id: String::new(),
                                set_number: 2,
                                set_type: "WORKING".into(),
                                prescribed: None,
                                actual_reps: Some(6),
                                actual_weight: Some(r#"{"value":225,"unit":"lb"}"#.into()),
                                actual_duration: None,
                                actual_distance: None,
                                actual_pace: None,
                                actual_heart_rate: None,
                                ruck_load: None,
                                elevation_gain: None,
                                rpe: Some(9),
                                completed: Some(true),
                                notes: None,
                            },
                        ],
                    }],
                }],
            },
            "user-1".into(),
        )
        .await
        .unwrap();

        assert_eq!(result.log.title, Some("Chest Day".into()));
        assert_eq!(result.groups.len(), 1);
        assert_eq!(result.activities.len(), 1);
        assert_eq!(result.sets.len(), 2);
        assert_eq!(result.sets[0].set_number, 1);
        assert_eq!(result.sets[1].set_number, 2);
    }

    #[tokio::test]
    async fn create_workout_log_full_rejects_invalid_started_at() {
        let pool = setup_test_db().await;

        let err = create_workout_log_full_inner(
            &pool,
            CreateWorkoutLogFullInput {
                log: CreateWorkoutLogInput {
                    user_id: "user-1".into(),
                    title: None,
                    started_at: -1,
                    completed_at: None,
                    session_template_id: None,
                    program_context: None,
                    overall_notes: None,
                    perceived_difficulty: None,
                    bodyweight_at_session: None,
                },
                groups: vec![],
            },
            "user-1".into(),
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("started_at"));
    }

    // -----------------------------------------------------------------------
    // get_workout_logs_summary -- with exercises table
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_workout_logs_summary_aggregates_data() {
        let pool = setup_test_db().await;
        let (log_id, _, _, _) = seed_full_workout(&pool).await;

        let summaries = get_workout_logs_summary_inner(&pool, "user-1".into(), None, None)
            .await
            .unwrap();

        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].log.id, log_id);
        assert_eq!(summaries[0].exercise_names, vec!["Back Squat".to_string()]);
        assert_eq!(summaries[0].set_count, 1); // 1 completed set
        assert_eq!(summaries[0].exercise_count, 1);
    }

    #[tokio::test]
    async fn get_workout_logs_summary_empty_for_unknown_user() {
        let pool = setup_test_db().await;

        let summaries = get_workout_logs_summary_inner(&pool, "nobody".into(), None, None)
            .await
            .unwrap();

        assert!(summaries.is_empty());
    }

    // -----------------------------------------------------------------------
    // get_recently_used_exercise_ids
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_recently_used_exercise_ids_returns_used_exercises() {
        let pool = setup_test_db().await;
        seed_full_workout(&pool).await;

        let ids = get_recently_used_exercise_ids_inner(&pool, "user-1".into(), None)
            .await
            .unwrap();

        assert_eq!(ids, vec!["ex-squat".to_string()]);
    }

    #[tokio::test]
    async fn get_recently_used_exercise_ids_empty_for_unknown_user() {
        let pool = setup_test_db().await;

        let ids = get_recently_used_exercise_ids_inner(&pool, "nobody".into(), None)
            .await
            .unwrap();

        assert!(ids.is_empty());
    }

    // -----------------------------------------------------------------------
    // get_exercise_workout_history
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_exercise_workout_history_returns_sets() {
        let pool = setup_test_db().await;
        seed_full_workout(&pool).await;

        let history =
            get_exercise_workout_history_inner(&pool, "user-1".into(), "ex-squat".into(), None)
                .await
                .unwrap();

        assert_eq!(history.len(), 1);
        assert_eq!(history[0].sets.len(), 1);
        assert_eq!(history[0].sets[0].actual_reps, Some(5));
    }

    #[tokio::test]
    async fn get_exercise_workout_history_empty_for_unknown_exercise() {
        let pool = setup_test_db().await;
        seed_full_workout(&pool).await;

        let history = get_exercise_workout_history_inner(
            &pool,
            "user-1".into(),
            "ex-nonexistent".into(),
            None,
        )
        .await
        .unwrap();

        assert!(history.is_empty());
    }

    // -----------------------------------------------------------------------
    // delete cascade behavior (manual cascade since SQLite FK off by default)
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn delete_workout_log_leaves_child_rows_orphaned() {
        let pool = setup_test_db().await;
        let (log_id, group_id, _, _) = seed_full_workout(&pool).await;

        // Delete the parent log
        delete_workout_log_inner(&pool, log_id).await.unwrap();

        // Child rows still exist (no FK cascade in test schema)
        let group: Option<LoggedActivityGroupRow> =
            sqlx::query_as("SELECT * FROM logged_activity_groups WHERE id = ?")
                .bind(&group_id)
                .fetch_optional(&pool)
                .await
                .unwrap();

        // The group row is still present since we have no ON DELETE CASCADE
        assert!(group.is_some());
    }

    // -----------------------------------------------------------------------
    // update_logged_set
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn update_logged_set_modifies_fields() {
        let pool = setup_test_db().await;
        let (_, _, act_id, set_id) = seed_full_workout(&pool).await;

        let updated = update_logged_set_inner(
            &pool,
            UpdateLoggedSetInput {
                id: set_id.clone(),
                logged_activity_id: act_id,
                set_number: 1,
                set_type: "WORKING".into(),
                prescribed: None,
                actual_reps: Some(10),
                actual_weight: Some(r#"{"value":335,"unit":"lb"}"#.into()),
                actual_duration: None,
                actual_distance: None,
                actual_pace: None,
                actual_heart_rate: None,
                ruck_load: None,
                elevation_gain: None,
                rpe: Some(9),
                completed: Some(true),
                notes: Some("PR attempt".into()),
            },
            "user-1".into(),
        )
        .await
        .unwrap();

        assert_eq!(updated.actual_reps, Some(10));
        assert_eq!(updated.rpe, Some(9));
        assert_eq!(updated.notes, Some("PR attempt".into()));
        assert!(updated.actual_weight.as_deref().unwrap().contains("335"));
    }
}
