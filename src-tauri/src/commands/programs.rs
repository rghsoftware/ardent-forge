use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    BlockRow, BlockWeekRow, ProgramActivationRow, ProgramFull, ProgramRow,
    ProgramWeekStatusRow, ScheduledSessionRow,
};
use crate::utils::now_unix;

// ---------------------------------------------------------------------------
// Validation structs (deserialization-only, mirrors TS SessionOverrides)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct ActivityOverride {
    exercise_id: Option<String>,
    set_scheme: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct SessionOverrides {
    activity_overrides: Option<HashMap<String, ActivityOverride>>,
}

// ---------------------------------------------------------------------------
// Input structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateScheduledSessionInput {
    pub id: Option<String>,
    pub day_of_week: Option<i64>,
    pub day_label: String,
    pub session_type: String,
    pub session_template_id: String,
    pub notes: Option<String>,
    pub overrides: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBlockWeekInput {
    pub id: Option<String>,
    pub week_number: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBlockWeekFullInput {
    pub week: CreateBlockWeekInput,
    pub sessions: Vec<CreateScheduledSessionInput>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBlockInput {
    pub id: Option<String>,
    pub name: String,
    pub ordinal: i64,
    pub duration_weeks: i64,
    pub block_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBlockFullInput {
    pub block: CreateBlockInput,
    pub weeks: Vec<CreateBlockWeekFullInput>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateProgramInput {
    pub id: Option<String>,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub source: String,
    pub duration_weeks: Option<i64>,
    pub is_public: bool,
    pub created_by: Option<String>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Lists all programs owned by the given user.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `user_id`: The owner's user ID to filter programs by.
///
/// # Returns
/// A vector of `ProgramRow` ordered by creation date descending.
#[tauri::command]
pub async fn get_programs(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<ProgramRow>, AppError> {
    let rows = sqlx::query_as::<_, ProgramRow>(
        "SELECT * FROM programs WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(&user_id)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}

/// Fetches a program with all its blocks, block weeks, and scheduled sessions.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `id`: The program's unique identifier.
///
/// # Returns
/// `Some(ProgramFull)` containing the program, its blocks, block weeks, and
/// scheduled sessions, or `None` if no program matches the ID.
#[tauri::command]
pub async fn get_program_full(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<ProgramFull>, AppError> {
    // Fetch the program
    let program = sqlx::query_as::<_, ProgramRow>("SELECT * FROM programs WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await?;

    let program = match program {
        Some(p) => p,
        None => return Ok(None),
    };

    // Fetch blocks
    let blocks =
        sqlx::query_as::<_, BlockRow>("SELECT * FROM blocks WHERE program_id = ? ORDER BY ordinal")
            .bind(&id)
            .fetch_all(pool.inner())
            .await?;

    let block_ids: Vec<String> = blocks.iter().map(|b| b.id.clone()).collect();

    if block_ids.is_empty() {
        return Ok(Some(ProgramFull {
            program,
            blocks: Vec::new(),
            block_weeks: Vec::new(),
            scheduled_sessions: Vec::new(),
        }));
    }

    // Fetch block weeks for all blocks
    let placeholders = block_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let weeks_sql = format!(
        "SELECT * FROM block_weeks WHERE block_id IN ({placeholders}) ORDER BY week_number"
    );
    let mut weeks_query = sqlx::query_as::<_, BlockWeekRow>(&weeks_sql);
    for bid in &block_ids {
        weeks_query = weeks_query.bind(bid);
    }
    let block_weeks = weeks_query.fetch_all(pool.inner()).await?;

    let week_ids: Vec<String> = block_weeks.iter().map(|w| w.id.clone()).collect();

    if week_ids.is_empty() {
        return Ok(Some(ProgramFull {
            program,
            blocks,
            block_weeks: Vec::new(),
            scheduled_sessions: Vec::new(),
        }));
    }

    // Fetch scheduled sessions for all weeks
    let placeholders = week_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sessions_sql = format!(
        "SELECT * FROM scheduled_sessions WHERE block_week_id IN ({placeholders}) ORDER BY day_of_week"
    );
    let mut sessions_query = sqlx::query_as::<_, ScheduledSessionRow>(&sessions_sql);
    for wid in &week_ids {
        sessions_query = sessions_query.bind(wid);
    }
    let scheduled_sessions = sessions_query.fetch_all(pool.inner()).await?;

    Ok(Some(ProgramFull {
        program,
        blocks,
        block_weeks,
        scheduled_sessions,
    }))
}

/// Creates a new program with all its blocks, block weeks, and scheduled
/// sessions in a single transaction.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `program`: The program header (name, source, duration, etc.).
/// - `blocks`: A vector of blocks, each containing weeks with their sessions.
///
/// # Returns
/// The fully created `ProgramFull` with all generated IDs and timestamps.
#[tauri::command]
pub async fn create_program_full(
    pool: State<'_, SqlitePool>,
    program: CreateProgramInput,
    blocks: Vec<CreateBlockFullInput>,
) -> Result<ProgramFull, AppError> {
    let program_id = program
        .id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = now_unix();

    let mut tx = pool.begin().await?;

    // Insert program
    sqlx::query(
        "INSERT INTO programs \
         (id, user_id, name, description, source, duration_weeks, \
          is_public, created_by, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&program_id)
    .bind(&program.user_id)
    .bind(&program.name)
    .bind(&program.description)
    .bind(&program.source)
    .bind(program.duration_weeks)
    .bind(program.is_public as i64)
    .bind(&program.created_by)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    let mut all_blocks: Vec<BlockRow> = Vec::new();
    let mut all_weeks: Vec<BlockWeekRow> = Vec::new();
    let mut all_sessions: Vec<ScheduledSessionRow> = Vec::new();

    for block_input in &blocks {
        let block_id = block_input
            .block
            .id
            .as_ref()
            .filter(|s| !s.is_empty())
            .cloned()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        sqlx::query(
            "INSERT INTO blocks \
             (id, program_id, name, ordinal, duration_weeks, block_type, \
              created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&block_id)
        .bind(&program_id)
        .bind(&block_input.block.name)
        .bind(block_input.block.ordinal)
        .bind(block_input.block.duration_weeks)
        .bind(&block_input.block.block_type)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        let block_row = sqlx::query_as::<_, BlockRow>("SELECT * FROM blocks WHERE id = ?")
            .bind(&block_id)
            .fetch_one(&mut *tx)
            .await?;
        all_blocks.push(block_row);

        for week_input in &block_input.weeks {
            let week_id = week_input
                .week
                .id
                .as_ref()
                .filter(|s| !s.is_empty())
                .cloned()
                .unwrap_or_else(|| Uuid::new_v4().to_string());

            sqlx::query(
                "INSERT INTO block_weeks \
                 (id, block_id, week_number, created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?)",
            )
            .bind(&week_id)
            .bind(&block_id)
            .bind(week_input.week.week_number)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await?;

            let week_row =
                sqlx::query_as::<_, BlockWeekRow>("SELECT * FROM block_weeks WHERE id = ?")
                    .bind(&week_id)
                    .fetch_one(&mut *tx)
                    .await?;
            all_weeks.push(week_row);

            for session_input in &week_input.sessions {
                if let Some(ref o) = session_input.overrides {
                    if serde_json::from_str::<SessionOverrides>(o).is_err() {
                        return Err(AppError::validation(
                            "overrides",
                            "[programs] Invalid overrides JSON: expected SessionOverrides shape",
                        ));
                    }
                }

                let session_id = session_input
                    .id
                    .as_ref()
                    .filter(|s| !s.is_empty())
                    .cloned()
                    .unwrap_or_else(|| Uuid::new_v4().to_string());

                sqlx::query(
                    "INSERT INTO scheduled_sessions \
                     (id, block_week_id, day_of_week, day_label, session_type, \
                      session_template_id, notes, overrides, created_at, updated_at) \
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(&session_id)
                .bind(&week_id)
                .bind(session_input.day_of_week)
                .bind(&session_input.day_label)
                .bind(&session_input.session_type)
                .bind(&session_input.session_template_id)
                .bind(&session_input.notes)
                .bind(&session_input.overrides)
                .bind(now)
                .bind(now)
                .execute(&mut *tx)
                .await?;

                let session_row = sqlx::query_as::<_, ScheduledSessionRow>(
                    "SELECT * FROM scheduled_sessions WHERE id = ?",
                )
                .bind(&session_id)
                .fetch_one(&mut *tx)
                .await?;
                all_sessions.push(session_row);
            }
        }
    }

    let program_row = sqlx::query_as::<_, ProgramRow>("SELECT * FROM programs WHERE id = ?")
        .bind(&program_id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(ProgramFull {
        program: program_row,
        blocks: all_blocks,
        block_weeks: all_weeks,
        scheduled_sessions: all_sessions,
    })
}

/// Updates an existing program by replacing all its blocks, block weeks, and
/// scheduled sessions in a single transaction. Existing blocks (and their
/// children) are deleted via ON DELETE CASCADE and re-inserted from the
/// provided input.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `program`: The updated program header; `id` is required.
/// - `blocks`: The full replacement set of blocks, weeks, and sessions.
///
/// # Returns
/// The fully updated `ProgramFull`, or an error if the program ID is missing
/// or the program does not exist.
#[tauri::command]
pub async fn update_program_full(
    pool: State<'_, SqlitePool>,
    program: CreateProgramInput,
    blocks: Vec<CreateBlockFullInput>,
) -> Result<ProgramFull, AppError> {
    let program_id = program
        .id
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::validation("id", "Program id is required for update"))?;
    let now = now_unix();

    let mut tx = pool.begin().await?;

    // Update program
    let result = sqlx::query(
        "UPDATE programs SET \
         user_id = ?, name = ?, description = ?, source = ?, \
         duration_weeks = ?, is_public = ?, created_by = ?, updated_at = ? \
         WHERE id = ?",
    )
    .bind(&program.user_id)
    .bind(&program.name)
    .bind(&program.description)
    .bind(&program.source)
    .bind(program.duration_weeks)
    .bind(program.is_public as i64)
    .bind(&program.created_by)
    .bind(now)
    .bind(&program_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("Program", &program_id));
    }

    // Delete existing blocks (cascades to weeks and sessions via FK ON DELETE CASCADE)
    sqlx::query("DELETE FROM blocks WHERE program_id = ?")
        .bind(&program_id)
        .execute(&mut *tx)
        .await?;

    // Re-insert all blocks, weeks, and sessions
    let mut all_blocks: Vec<BlockRow> = Vec::new();
    let mut all_weeks: Vec<BlockWeekRow> = Vec::new();
    let mut all_sessions: Vec<ScheduledSessionRow> = Vec::new();

    for block_input in &blocks {
        let block_id = block_input
            .block
            .id
            .as_ref()
            .filter(|s| !s.is_empty())
            .cloned()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        sqlx::query(
            "INSERT INTO blocks \
             (id, program_id, name, ordinal, duration_weeks, block_type, \
              created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&block_id)
        .bind(&program_id)
        .bind(&block_input.block.name)
        .bind(block_input.block.ordinal)
        .bind(block_input.block.duration_weeks)
        .bind(&block_input.block.block_type)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        let block_row = sqlx::query_as::<_, BlockRow>("SELECT * FROM blocks WHERE id = ?")
            .bind(&block_id)
            .fetch_one(&mut *tx)
            .await?;
        all_blocks.push(block_row);

        for week_input in &block_input.weeks {
            let week_id = week_input
                .week
                .id
                .as_ref()
                .filter(|s| !s.is_empty())
                .cloned()
                .unwrap_or_else(|| Uuid::new_v4().to_string());

            sqlx::query(
                "INSERT INTO block_weeks \
                 (id, block_id, week_number, created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?)",
            )
            .bind(&week_id)
            .bind(&block_id)
            .bind(week_input.week.week_number)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await?;

            let week_row =
                sqlx::query_as::<_, BlockWeekRow>("SELECT * FROM block_weeks WHERE id = ?")
                    .bind(&week_id)
                    .fetch_one(&mut *tx)
                    .await?;
            all_weeks.push(week_row);

            for session_input in &week_input.sessions {
                if let Some(ref o) = session_input.overrides {
                    if serde_json::from_str::<SessionOverrides>(o).is_err() {
                        return Err(AppError::validation(
                            "overrides",
                            "[programs] Invalid overrides JSON: expected SessionOverrides shape",
                        ));
                    }
                }

                let session_id = session_input
                    .id
                    .as_ref()
                    .filter(|s| !s.is_empty())
                    .cloned()
                    .unwrap_or_else(|| Uuid::new_v4().to_string());

                sqlx::query(
                    "INSERT INTO scheduled_sessions \
                     (id, block_week_id, day_of_week, day_label, session_type, \
                      session_template_id, notes, overrides, created_at, updated_at) \
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(&session_id)
                .bind(&week_id)
                .bind(session_input.day_of_week)
                .bind(&session_input.day_label)
                .bind(&session_input.session_type)
                .bind(&session_input.session_template_id)
                .bind(&session_input.notes)
                .bind(&session_input.overrides)
                .bind(now)
                .bind(now)
                .execute(&mut *tx)
                .await?;

                let session_row = sqlx::query_as::<_, ScheduledSessionRow>(
                    "SELECT * FROM scheduled_sessions WHERE id = ?",
                )
                .bind(&session_id)
                .fetch_one(&mut *tx)
                .await?;
                all_sessions.push(session_row);
            }
        }
    }

    let program_row = sqlx::query_as::<_, ProgramRow>("SELECT * FROM programs WHERE id = ?")
        .bind(&program_id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(ProgramFull {
        program: program_row,
        blocks: all_blocks,
        block_weeks: all_weeks,
        scheduled_sessions: all_sessions,
    })
}

/// Deletes a program and all its associated blocks, block weeks, and scheduled
/// sessions (cascaded via foreign key constraints).
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `id`: The program's unique identifier.
///
/// # Returns
/// `Ok(())` on success, or a not-found error if no program matches the ID.
#[tauri::command]
pub async fn delete_program(pool: State<'_, SqlitePool>, id: String) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM programs WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("Program", &id));
    }
    Ok(())
}

/// Assigns a program owned by the caller (a coach) to a group member.
///
/// This transfers ownership of the program and its linked session templates
/// from the caller to the target member. The caller must be a COACH in the
/// specified group, the target must be a MEMBER, and the program must be
/// owned by the caller.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `caller_id`: The coach's user ID.
/// - `program_id`: The program to assign.
/// - `member_id`: The target member's user ID.
/// - `group_id`: The accountability group ID for role validation.
///
/// # Returns
/// The updated `ProgramRow` with ownership transferred to the member.
#[tauri::command]
pub async fn assign_program_to_member(
    pool: State<'_, SqlitePool>,
    caller_id: String,
    program_id: String,
    member_id: String,
    group_id: String,
) -> Result<ProgramRow, AppError> {
    // Validate caller is COACH in the group
    let caller_role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&group_id)
    .bind(&caller_id)
    .fetch_optional(pool.inner())
    .await?;

    match caller_role.as_deref() {
        Some("COACH") => {}
        _ => {
            return Err(AppError::unauthorized(
                "caller is not a coach in this group",
            ))
        }
    }

    // Validate target is MEMBER in the group
    let member_role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
    )
    .bind(&group_id)
    .bind(&member_id)
    .fetch_optional(pool.inner())
    .await?;

    match member_role.as_deref() {
        Some("MEMBER") => {}
        _ => {
            return Err(AppError::unauthorized(
                "target user is not a member of this group",
            ))
        }
    }

    // Validate program is owned by caller
    let owned =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM programs WHERE id = ? AND user_id = ?")
            .bind(&program_id)
            .bind(&caller_id)
            .fetch_one(pool.inner())
            .await?;

    if owned == 0 {
        return Err(AppError::not_found("Program", &program_id));
    }

    let mut tx = pool.begin().await?;

    // Transfer session template ownership to the member
    sqlx::query(
        "UPDATE session_templates SET user_id = ? \
         WHERE id IN ( \
             SELECT ss.session_template_id \
             FROM scheduled_sessions ss \
             JOIN block_weeks bw ON ss.block_week_id = bw.id \
             JOIN blocks b ON bw.block_id = b.id \
             WHERE b.program_id = ? \
               AND ss.session_template_id IS NOT NULL \
         )",
    )
    .bind(&member_id)
    .bind(&program_id)
    .execute(&mut *tx)
    .await?;

    // Transfer program ownership to the member and tag as coach-assigned
    let program = sqlx::query_as::<_, ProgramRow>(
        "UPDATE programs SET user_id = ?, source = 'COACH_ASSIGNED', created_by = ? WHERE id = ? RETURNING *",
    )
    .bind(&member_id)
    .bind(&caller_id)
    .bind(&program_id)
    .fetch_one(&mut *tx)
    .await?;

    // Clear coach's active program if it was the assigned program
    sqlx::query("DELETE FROM program_activations WHERE user_id = ? AND program_id = ?")
        .bind(&caller_id)
        .bind(&program_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(program)
}

/// Fetches the active program activation for a user.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `user_id`: The user's unique identifier.
///
/// # Returns
/// `Some(ProgramActivationRow)` if the user has an active program, or `None`.
#[tauri::command]
pub async fn get_active_program(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Option<ProgramActivationRow>, AppError> {
    let row = sqlx::query_as::<_, ProgramActivationRow>(
        "SELECT * FROM program_activations WHERE user_id = ?",
    )
    .bind(&user_id)
    .fetch_optional(pool.inner())
    .await?;

    Ok(row)
}

/// Sets (or replaces) the active program for a user. Uses INSERT ... ON
/// CONFLICT to enforce the UNIQUE(user_id) constraint, ensuring only one
/// active program per user.
///
/// Note: Uses INSERT ... ON CONFLICT to preserve the original created_at
/// timestamp when replacing an existing activation.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `user_id`: The user's unique identifier.
/// - `program_id`: The program to activate.
/// - `start_date`: Optional start date (YYYY-MM-DD). Defaults to today.
///
/// # Returns
/// The created or replaced `ProgramActivationRow`.
#[tauri::command]
pub async fn set_active_program(
    pool: State<'_, SqlitePool>,
    user_id: String,
    program_id: String,
    start_date: Option<String>,
) -> Result<ProgramActivationRow, AppError> {
    let activation_id = Uuid::new_v4().to_string();
    let now = now_unix();
    let date = start_date.unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());

    sqlx::query(
        "INSERT INTO program_activations \
         (id, user_id, program_id, current_block_ordinal, current_week_number, \
          start_date, created_at, updated_at) \
         VALUES (?, ?, ?, 1, 1, ?, ?, ?) \
         ON CONFLICT(user_id) DO UPDATE SET \
           program_id = excluded.program_id, \
           current_block_ordinal = excluded.current_block_ordinal, \
           current_week_number = excluded.current_week_number, \
           start_date = excluded.start_date, \
           updated_at = excluded.updated_at",
    )
    .bind(&activation_id)
    .bind(&user_id)
    .bind(&program_id)
    .bind(&date)
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await?;

    let row = sqlx::query_as::<_, ProgramActivationRow>(
        "SELECT * FROM program_activations WHERE user_id = ?",
    )
    .bind(&user_id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

/// Clears the active program for a user.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `user_id`: The user's unique identifier.
///
/// # Returns
/// `Ok(())` on success, or a not-found error if the user has no active program.
#[tauri::command]
pub async fn clear_active_program(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM program_activations WHERE user_id = ?")
        .bind(&user_id)
        .execute(pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("ProgramActivation", &user_id));
    }
    Ok(())
}

/// Updates fields on the active program activation for a user. Only provided
/// (non-None) fields are updated; others are left unchanged.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `user_id`: The user whose activation to update.
/// - `current_block_ordinal`: Optional new block ordinal.
/// - `current_week_number`: Optional new week number.
/// - `start_date`: Optional new start date (YYYY-MM-DD).
///
/// # Returns
/// The updated `ProgramActivationRow`, or a not-found error if the user has no
/// active program.
#[tauri::command]
pub async fn update_active_program(
    pool: State<'_, SqlitePool>,
    user_id: String,
    current_block_ordinal: Option<i64>,
    current_week_number: Option<i64>,
    start_date: Option<String>,
) -> Result<ProgramActivationRow, AppError> {
    if current_block_ordinal.is_none() && current_week_number.is_none() && start_date.is_none() {
        return Err(AppError::validation(
            "fields",
            "[programs] At least one field must be provided for update",
        ));
    }

    let now = now_unix();
    let mut set_clauses: Vec<String> = Vec::new();

    if current_block_ordinal.is_some() {
        set_clauses.push("current_block_ordinal = ?".to_string());
    }
    if current_week_number.is_some() {
        set_clauses.push("current_week_number = ?".to_string());
    }
    if start_date.is_some() {
        set_clauses.push("start_date = ?".to_string());
    }
    set_clauses.push("updated_at = ?".to_string());

    let sql = format!(
        "UPDATE program_activations SET {} WHERE user_id = ?",
        set_clauses.join(", ")
    );

    let mut query = sqlx::query(&sql);

    if let Some(ref block_ord) = current_block_ordinal {
        query = query.bind(block_ord);
    }
    if let Some(ref week_num) = current_week_number {
        query = query.bind(week_num);
    }
    if let Some(ref date) = start_date {
        query = query.bind(date);
    }
    query = query.bind(now);
    query = query.bind(&user_id);

    let result = query.execute(pool.inner()).await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("ProgramActivation", &user_id));
    }

    let row = sqlx::query_as::<_, ProgramActivationRow>(
        "SELECT * FROM program_activations WHERE user_id = ?",
    )
    .bind(&user_id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

/// Fetches all week statuses for a given program activation.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `activation_id`: The activation's unique identifier.
///
/// # Returns
/// A vector of `ProgramWeekStatusRow` for the activation.
#[tauri::command]
pub async fn get_week_statuses(
    pool: State<'_, SqlitePool>,
    activation_id: String,
) -> Result<Vec<ProgramWeekStatusRow>, AppError> {
    let rows = sqlx::query_as::<_, ProgramWeekStatusRow>(
        "SELECT * FROM program_week_statuses WHERE activation_id = ? \
         ORDER BY block_ordinal, week_number",
    )
    .bind(&activation_id)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}

// ---------------------------------------------------------------------------
// Week status upsert input
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeekStatusInput {
    pub block_ordinal: i64,
    pub week_number: i64,
    pub status: String,
}

/// Upserts week statuses for a program activation. For each entry, inserts a
/// new row or replaces the existing one (keyed by activation_id +
/// block_ordinal + week_number). Returns the full list of statuses for the
/// activation after the upsert.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `activation_id`: The activation's unique identifier.
/// - `statuses`: A vector of week statuses to upsert.
///
/// # Returns
/// The complete `Vec<ProgramWeekStatusRow>` for the activation after upsert.
#[tauri::command]
pub async fn upsert_week_statuses(
    pool: State<'_, SqlitePool>,
    activation_id: String,
    statuses: Vec<WeekStatusInput>,
) -> Result<Vec<ProgramWeekStatusRow>, AppError> {
    // Validate all statuses before starting the transaction
    for s in &statuses {
        if s.status != "done" && s.status != "skipped" {
            return Err(AppError::validation(
                "status",
                &format!(
                    "[programs] Invalid week status '{}': must be 'done' or 'skipped'",
                    s.status
                ),
            ));
        }
    }

    let mut tx = pool.begin().await?;

    for s in &statuses {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO program_week_statuses \
             (id, activation_id, block_ordinal, week_number, status) \
             VALUES (?, ?, ?, ?, ?) \
             ON CONFLICT(activation_id, block_ordinal, week_number) DO UPDATE SET \
               status = excluded.status",
        )
        .bind(&id)
        .bind(&activation_id)
        .bind(s.block_ordinal)
        .bind(s.week_number)
        .bind(&s.status)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    // Return the full list for the activation
    let rows = sqlx::query_as::<_, ProgramWeekStatusRow>(
        "SELECT * FROM program_week_statuses WHERE activation_id = ? \
         ORDER BY block_ordinal, week_number",
    )
    .bind(&activation_id)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}
