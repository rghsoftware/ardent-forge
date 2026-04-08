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
    pub note_tags: Option<String>, // JSON array string
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
    pub note_tags: Option<String>, // JSON array string
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
    pub note_tags: Option<String>, // JSON array string
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
    pub note_tags: Option<String>, // JSON array string
}

#[derive(serde::Deserialize)]
pub struct UpdateLoggedActivityInput {
    pub id: String,
    pub logged_group_id: String,
    pub exercise_id: String,
    pub ordinal: i32,
    pub notes: Option<String>,
    pub note_tags: Option<String>, // JSON array string
}

#[derive(serde::Deserialize)]
pub struct UpdateLoggedActivityGroupInput {
    pub id: String,
    pub workout_log_id: String,
    pub group_type: String,
    pub ordinal: i32,
    pub actual_rounds_completed: Option<i32>,
    pub completion_time: Option<String>,
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
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_workout_logs(
    pool: State<'_, SqlitePool>,
    user_id: String,
    limit: Option<i64>,
) -> Result<Vec<WorkoutLogRow>, AppError> {
    let lim = limit.unwrap_or(50);
    let rows = sqlx::query_as::<_, WorkoutLogRow>(
        "SELECT * FROM workout_logs WHERE user_id = ? ORDER BY started_at DESC LIMIT ?",
    )
    .bind(&user_id)
    .bind(lim)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}

#[tauri::command]
pub async fn get_workout_logs_summary(
    pool: State<'_, SqlitePool>,
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
    .fetch_all(pool.inner())
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
    let agg_rows = query.fetch_all(pool.inner()).await?;

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

#[tauri::command]
pub async fn get_workout_log(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<WorkoutLogRow>, AppError> {
    let row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await?;

    Ok(row)
}

#[tauri::command]
pub async fn get_workout_log_full(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<WorkoutLogFull>, AppError> {
    // Fetch the workout log
    let log_row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
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
    .fetch_all(pool.inner())
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
    let act_rows = act_query.fetch_all(pool.inner()).await?;

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
    let set_rows = set_query.fetch_all(pool.inner()).await?;

    Ok(Some(WorkoutLogFull {
        log: log_row,
        groups: group_rows,
        activities: act_rows,
        sets: set_rows,
    }))
}

#[tauri::command]
pub async fn create_workout_log(
    pool: State<'_, SqlitePool>,
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
          program_context, overall_notes, note_tags, perceived_difficulty, bodyweight_at_session, \
          created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&log.user_id)
    .bind(&log.title)
    .bind(log.started_at)
    .bind(log.completed_at)
    .bind(&log.session_template_id)
    .bind(&log.program_context)
    .bind(&log.overall_notes)
    .bind(log.note_tags.as_deref().unwrap_or("[]"))
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

#[tauri::command]
pub async fn update_workout_log(
    pool: State<'_, SqlitePool>,
    id: String,
    title: Option<String>,
    completed_at: Option<i64>,
    overall_notes: Option<String>,
    note_tags: Option<String>,
    perceived_difficulty: Option<i32>,
) -> Result<WorkoutLogRow, AppError> {
    let now = now_unix();

    let result = sqlx::query(
        "UPDATE workout_logs SET \
         title = ?, \
         completed_at = ?, \
         overall_notes = ?, \
         note_tags = ?, \
         perceived_difficulty = ?, \
         updated_at = ? \
         WHERE id = ?",
    )
    .bind(&title)
    .bind(completed_at)
    .bind(&overall_notes)
    .bind(note_tags.as_deref().unwrap_or("[]"))
    .bind(perceived_difficulty)
    .bind(now)
    .bind(&id)
    .execute(pool.inner())
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("WorkoutLog", &id));
    }

    let row = sqlx::query_as::<_, WorkoutLogRow>("SELECT * FROM workout_logs WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await?;

    Ok(row)
}

#[tauri::command]
pub async fn delete_workout_log(pool: State<'_, SqlitePool>, id: String) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM workout_logs WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("WorkoutLog", &id));
    }
    Ok(())
}

#[tauri::command]
pub async fn create_logged_activity_group(
    pool: State<'_, SqlitePool>,
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

#[tauri::command]
pub async fn create_logged_activity(
    pool: State<'_, SqlitePool>,
    activity: CreateLoggedActivityInput,
    user_id: String,
) -> Result<LoggedActivityRow, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();

    let mut tx = pool.begin().await?;

    sqlx::query(
        "INSERT INTO logged_activities \
         (id, logged_group_id, user_id, exercise_id, ordinal, notes, note_tags, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&activity.logged_group_id)
    .bind(&user_id)
    .bind(&activity.exercise_id)
    .bind(activity.ordinal)
    .bind(&activity.notes)
    .bind(activity.note_tags.as_deref().unwrap_or("[]"))
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

#[tauri::command]
pub async fn create_logged_set(
    pool: State<'_, SqlitePool>,
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
          actual_heart_rate, ruck_load, elevation_gain, rpe, completed, notes, note_tags, \
          created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
    .bind(set.note_tags.as_deref().unwrap_or("[]"))
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

#[tauri::command]
pub async fn update_logged_set(
    pool: State<'_, SqlitePool>,
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
         elevation_gain = ?, rpe = ?, completed = ?, notes = ?, note_tags = ?, updated_at = ? \
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
    .bind(set.note_tags.as_deref().unwrap_or("[]"))
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

#[tauri::command]
pub async fn get_recently_used_exercise_ids(
    pool: State<'_, SqlitePool>,
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
    .fetch_all(pool.inner())
    .await?;

    Ok(rows.into_iter().map(|r| r.exercise_id).collect())
}

#[tauri::command]
pub async fn get_exercise_workout_history(
    pool: State<'_, SqlitePool>,
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
    .fetch_all(pool.inner())
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
    let logs = logs_query.fetch_all(pool.inner()).await?;

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
        note_tags: String,
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
    let flat_sets = sets_query.fetch_all(pool.inner()).await?;

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
            note_tags: fs.note_tags,
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

#[tauri::command]
pub async fn create_workout_log_full(
    pool: State<'_, SqlitePool>,
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
          program_context, overall_notes, note_tags, perceived_difficulty, bodyweight_at_session, \
          created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&log_id)
    .bind(&user_id)
    .bind(&input.log.title)
    .bind(input.log.started_at)
    .bind(input.log.completed_at)
    .bind(&input.log.session_template_id)
    .bind(&input.log.program_context)
    .bind(&input.log.overall_notes)
    .bind(input.log.note_tags.as_deref().unwrap_or("[]"))
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
                 (id, logged_group_id, user_id, exercise_id, ordinal, notes, note_tags, created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&act_id)
            .bind(&group_id)
            .bind(&user_id)
            .bind(&act_input.activity.exercise_id)
            .bind(act_input.activity.ordinal)
            .bind(&act_input.activity.notes)
            .bind(act_input.activity.note_tags.as_deref().unwrap_or("[]"))
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
                      actual_heart_rate, ruck_load, elevation_gain, rpe, completed, notes, note_tags, \
                      created_at, updated_at) \
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
                .bind(set_input.note_tags.as_deref().unwrap_or("[]"))
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

#[tauri::command]
pub async fn delete_logged_set(pool: State<'_, SqlitePool>, id: String) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM logged_sets WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("LoggedSet", &id));
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_logged_activity(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM logged_activities WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("LoggedActivity", &id));
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_logged_activity_group(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM logged_activity_groups WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("LoggedActivityGroup", &id));
    }
    Ok(())
}

#[tauri::command]
pub async fn update_logged_activity(
    pool: State<'_, SqlitePool>,
    activity: UpdateLoggedActivityInput,
    user_id: String,
) -> Result<LoggedActivityRow, AppError> {
    let now = now_unix();

    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        "UPDATE logged_activities SET \
         logged_group_id = ?, user_id = ?, exercise_id = ?, ordinal = ?, notes = ?, note_tags = ?, updated_at = ? \
         WHERE id = ?",
    )
    .bind(&activity.logged_group_id)
    .bind(&user_id)
    .bind(&activity.exercise_id)
    .bind(activity.ordinal)
    .bind(&activity.notes)
    .bind(activity.note_tags.as_deref().unwrap_or("[]"))
    .bind(now)
    .bind(&activity.id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("LoggedActivity", &activity.id));
    }

    let row =
        sqlx::query_as::<_, LoggedActivityRow>("SELECT * FROM logged_activities WHERE id = ?")
            .bind(&activity.id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;

    Ok(row)
}

#[tauri::command]
pub async fn update_logged_activity_group(
    pool: State<'_, SqlitePool>,
    group: UpdateLoggedActivityGroupInput,
    user_id: String,
) -> Result<LoggedActivityGroupRow, AppError> {
    let now = now_unix();

    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        "UPDATE logged_activity_groups SET \
         workout_log_id = ?, user_id = ?, group_type = ?, ordinal = ?, \
         actual_rounds_completed = ?, completion_time = ?, updated_at = ? \
         WHERE id = ?",
    )
    .bind(&group.workout_log_id)
    .bind(&user_id)
    .bind(&group.group_type)
    .bind(group.ordinal)
    .bind(group.actual_rounds_completed)
    .bind(&group.completion_time)
    .bind(now)
    .bind(&group.id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("LoggedActivityGroup", &group.id));
    }

    let row = sqlx::query_as::<_, LoggedActivityGroupRow>(
        "SELECT * FROM logged_activity_groups WHERE id = ?",
    )
    .bind(&group.id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(row)
}
