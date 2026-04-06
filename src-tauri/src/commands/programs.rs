use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{
    BlockRow, BlockWeekRow, ProgramActivationRow, ProgramFull, ProgramRow, ScheduledSessionRow,
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
// Commands (thin wrappers delegating to inner functions for testability)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_programs(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<ProgramRow>, AppError> {
    get_programs_inner(pool.inner(), user_id).await
}

#[tauri::command]
pub async fn get_program_full(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<ProgramFull>, AppError> {
    get_program_full_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn create_program_full(
    pool: State<'_, SqlitePool>,
    program: CreateProgramInput,
    blocks: Vec<CreateBlockFullInput>,
) -> Result<ProgramFull, AppError> {
    create_program_full_inner(pool.inner(), program, blocks).await
}

#[tauri::command]
pub async fn update_program_full(
    pool: State<'_, SqlitePool>,
    program: CreateProgramInput,
    blocks: Vec<CreateBlockFullInput>,
) -> Result<ProgramFull, AppError> {
    update_program_full_inner(pool.inner(), program, blocks).await
}

#[tauri::command]
pub async fn delete_program(pool: State<'_, SqlitePool>, id: String) -> Result<(), AppError> {
    delete_program_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn assign_program_to_member(
    pool: State<'_, SqlitePool>,
    caller_id: String,
    program_id: String,
    member_id: String,
    group_id: String,
) -> Result<ProgramRow, AppError> {
    assign_program_to_member_inner(pool.inner(), caller_id, program_id, member_id, group_id).await
}

#[tauri::command]
pub async fn get_active_program(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Option<ProgramActivationRow>, AppError> {
    get_active_program_inner(pool.inner(), user_id).await
}

#[tauri::command]
pub async fn set_active_program(
    pool: State<'_, SqlitePool>,
    user_id: String,
    program_id: String,
    start_date: Option<String>,
) -> Result<ProgramActivationRow, AppError> {
    set_active_program_inner(pool.inner(), user_id, program_id, start_date).await
}

#[tauri::command]
pub async fn clear_active_program(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<(), AppError> {
    clear_active_program_inner(pool.inner(), user_id).await
}

// ---------------------------------------------------------------------------
// Inner functions (testable, take &SqlitePool directly)
// ---------------------------------------------------------------------------

pub(crate) async fn get_programs_inner(
    pool: &SqlitePool,
    user_id: String,
) -> Result<Vec<ProgramRow>, AppError> {
    let rows = sqlx::query_as::<_, ProgramRow>(
        "SELECT * FROM programs WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub(crate) async fn get_program_full_inner(
    pool: &SqlitePool,
    id: String,
) -> Result<Option<ProgramFull>, AppError> {
    // Fetch the program
    let program = sqlx::query_as::<_, ProgramRow>("SELECT * FROM programs WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool)
        .await?;

    let program = match program {
        Some(p) => p,
        None => return Ok(None),
    };

    // Fetch blocks
    let blocks =
        sqlx::query_as::<_, BlockRow>("SELECT * FROM blocks WHERE program_id = ? ORDER BY ordinal")
            .bind(&id)
            .fetch_all(pool)
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
    let block_weeks = weeks_query.fetch_all(pool).await?;

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
    let scheduled_sessions = sessions_query.fetch_all(pool).await?;

    Ok(Some(ProgramFull {
        program,
        blocks,
        block_weeks,
        scheduled_sessions,
    }))
}

pub(crate) async fn create_program_full_inner(
    pool: &SqlitePool,
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

pub(crate) async fn update_program_full_inner(
    pool: &SqlitePool,
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

pub(crate) async fn delete_program_inner(pool: &SqlitePool, id: String) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM programs WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("Program", &id));
    }
    Ok(())
}

pub(crate) async fn assign_program_to_member_inner(
    pool: &SqlitePool,
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
    .fetch_optional(pool)
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
    .fetch_optional(pool)
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
            .fetch_one(pool)
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

pub(crate) async fn get_active_program_inner(
    pool: &SqlitePool,
    user_id: String,
) -> Result<Option<ProgramActivationRow>, AppError> {
    let row = sqlx::query_as::<_, ProgramActivationRow>(
        "SELECT * FROM program_activations WHERE user_id = ?",
    )
    .bind(&user_id)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

pub(crate) async fn set_active_program_inner(
    pool: &SqlitePool,
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
    .execute(pool)
    .await?;

    let row = sqlx::query_as::<_, ProgramActivationRow>(
        "SELECT * FROM program_activations WHERE user_id = ?",
    )
    .bind(&user_id)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

pub(crate) async fn clear_active_program_inner(
    pool: &SqlitePool,
    user_id: String,
) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM program_activations WHERE user_id = ?")
        .bind(&user_id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("ProgramActivation", &user_id));
    }
    Ok(())
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    const PROGRAMS_DDL: &str = "\
        PRAGMA foreign_keys = ON;\
        CREATE TABLE IF NOT EXISTS session_templates (\
            id TEXT PRIMARY KEY, \
            user_id TEXT NOT NULL, \
            name TEXT NOT NULL, \
            description TEXT, \
            category TEXT NOT NULL, \
            rest_between_groups TEXT, \
            time_cap TEXT, \
            scoring TEXT NOT NULL, \
            last_assigned_at INTEGER, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS programs (\
            id TEXT PRIMARY KEY, \
            user_id TEXT NOT NULL, \
            name TEXT NOT NULL, \
            description TEXT, \
            source TEXT NOT NULL, \
            duration_weeks INTEGER, \
            is_public INTEGER NOT NULL DEFAULT 0, \
            created_by TEXT, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS blocks (\
            id TEXT PRIMARY KEY, \
            program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE, \
            name TEXT NOT NULL, \
            ordinal INTEGER NOT NULL, \
            duration_weeks INTEGER NOT NULL, \
            block_type TEXT NOT NULL, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS block_weeks (\
            id TEXT PRIMARY KEY, \
            block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE, \
            week_number INTEGER NOT NULL, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS scheduled_sessions (\
            id TEXT PRIMARY KEY, \
            block_week_id TEXT NOT NULL REFERENCES block_weeks(id) ON DELETE CASCADE, \
            day_of_week INTEGER, \
            day_label TEXT NOT NULL, \
            session_type TEXT NOT NULL, \
            session_template_id TEXT NOT NULL, \
            notes TEXT, \
            overrides TEXT, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS program_activations (\
            id TEXT PRIMARY KEY, \
            user_id TEXT NOT NULL UNIQUE, \
            program_id TEXT NOT NULL, \
            current_block_ordinal INTEGER NOT NULL DEFAULT 1, \
            current_week_number INTEGER NOT NULL DEFAULT 1, \
            start_date TEXT NOT NULL, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS group_members (\
            id TEXT PRIMARY KEY, \
            group_id TEXT NOT NULL, \
            user_id TEXT NOT NULL, \
            role TEXT NOT NULL, \
            share_history_before_join INTEGER NOT NULL DEFAULT 0, \
            joined_at INTEGER, \
            created_at INTEGER, \
            updated_at INTEGER\
        );";

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("in-memory pool");

        for stmt in PROGRAMS_DDL.split(';') {
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

    fn make_program_input(id: Option<&str>) -> CreateProgramInput {
        CreateProgramInput {
            id: id.map(String::from),
            user_id: "user-1".into(),
            name: "Strength Base".into(),
            description: Some("12-week linear periodization".into()),
            source: "SELF_CREATED".into(),
            duration_weeks: Some(12),
            is_public: false,
            created_by: None,
        }
    }

    fn make_blocks() -> Vec<CreateBlockFullInput> {
        vec![CreateBlockFullInput {
            block: CreateBlockInput {
                id: None,
                name: "Hypertrophy".into(),
                ordinal: 1,
                duration_weeks: 4,
                block_type: "hypertrophy".into(),
            },
            weeks: vec![CreateBlockWeekFullInput {
                week: CreateBlockWeekInput {
                    id: None,
                    week_number: 1,
                },
                sessions: vec![CreateScheduledSessionInput {
                    id: None,
                    day_of_week: Some(1),
                    day_label: "Monday".into(),
                    session_type: "strength".into(),
                    session_template_id: "tmpl-1".into(),
                    notes: None,
                    overrides: None,
                }],
            }],
        }]
    }

    /// Creates a program via create_program_full_inner and returns it.
    async fn seed_program(pool: &SqlitePool) -> ProgramFull {
        create_program_full_inner(pool, make_program_input(None), make_blocks())
            .await
            .expect("seed program")
    }

    // -----------------------------------------------------------------------
    // get_programs
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_programs_returns_user_programs() {
        let pool = setup_test_db().await;
        seed_program(&pool).await;

        let rows = get_programs_inner(&pool, "user-1".into()).await.unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Strength Base");
    }

    #[tokio::test]
    async fn get_programs_returns_empty_for_unknown_user() {
        let pool = setup_test_db().await;

        let rows = get_programs_inner(&pool, "nobody".into()).await.unwrap();

        assert!(rows.is_empty());
    }

    // -----------------------------------------------------------------------
    // get_program_full
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_program_full_returns_nested_data() {
        let pool = setup_test_db().await;
        let created = seed_program(&pool).await;

        let full = get_program_full_inner(&pool, created.program.id.clone())
            .await
            .unwrap()
            .expect("should be Some");

        assert_eq!(full.program.id, created.program.id);
        assert_eq!(full.blocks.len(), 1);
        assert_eq!(full.blocks[0].name, "Hypertrophy");
        assert_eq!(full.block_weeks.len(), 1);
        assert_eq!(full.block_weeks[0].week_number, 1);
        assert_eq!(full.scheduled_sessions.len(), 1);
        assert_eq!(full.scheduled_sessions[0].day_label, "Monday");
    }

    #[tokio::test]
    async fn get_program_full_returns_none_for_missing() {
        let pool = setup_test_db().await;

        let result = get_program_full_inner(&pool, "nonexistent".into())
            .await
            .unwrap();

        assert!(result.is_none());
    }

    // -----------------------------------------------------------------------
    // create_program_full
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn create_program_full_persists_all_rows() {
        let pool = setup_test_db().await;

        let result = create_program_full_inner(&pool, make_program_input(None), make_blocks())
            .await
            .unwrap();

        assert_eq!(result.program.name, "Strength Base");
        assert_eq!(result.program.source, "SELF_CREATED");
        assert_eq!(result.program.is_public, 0);
        assert_eq!(result.blocks.len(), 1);
        assert_eq!(result.block_weeks.len(), 1);
        assert_eq!(result.scheduled_sessions.len(), 1);
    }

    // -----------------------------------------------------------------------
    // update_program_full
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn update_program_full_replaces_blocks() {
        let pool = setup_test_db().await;
        let created = seed_program(&pool).await;
        let pid = created.program.id.clone();

        let new_blocks = vec![CreateBlockFullInput {
            block: CreateBlockInput {
                id: None,
                name: "Peaking".into(),
                ordinal: 1,
                duration_weeks: 2,
                block_type: "peaking".into(),
            },
            weeks: vec![
                CreateBlockWeekFullInput {
                    week: CreateBlockWeekInput {
                        id: None,
                        week_number: 1,
                    },
                    sessions: vec![CreateScheduledSessionInput {
                        id: None,
                        day_of_week: Some(1),
                        day_label: "Mon".into(),
                        session_type: "strength".into(),
                        session_template_id: "tmpl-2".into(),
                        notes: None,
                        overrides: None,
                    }],
                },
                CreateBlockWeekFullInput {
                    week: CreateBlockWeekInput {
                        id: None,
                        week_number: 2,
                    },
                    sessions: vec![],
                },
            ],
        }];

        let mut updated_input = make_program_input(Some(&pid));
        updated_input.name = "Peaking Program".into();

        let updated = update_program_full_inner(&pool, updated_input, new_blocks)
            .await
            .unwrap();

        assert_eq!(updated.program.name, "Peaking Program");
        assert_eq!(updated.blocks.len(), 1);
        assert_eq!(updated.blocks[0].name, "Peaking");
        assert_eq!(updated.block_weeks.len(), 2);
        assert_eq!(updated.scheduled_sessions.len(), 1);
    }

    #[tokio::test]
    async fn update_program_full_rejects_missing_id() {
        let pool = setup_test_db().await;

        let err = update_program_full_inner(&pool, make_program_input(None), make_blocks())
            .await
            .unwrap_err();

        assert!(err.message.contains("required for update"));
    }

    // -----------------------------------------------------------------------
    // delete_program
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn delete_program_removes_program() {
        let pool = setup_test_db().await;
        let created = seed_program(&pool).await;

        delete_program_inner(&pool, created.program.id.clone())
            .await
            .unwrap();

        let result = get_program_full_inner(&pool, created.program.id)
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn delete_program_returns_not_found() {
        let pool = setup_test_db().await;

        let err = delete_program_inner(&pool, "nonexistent".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("not found"));
    }

    // -----------------------------------------------------------------------
    // set_active_program / get_active_program / clear_active_program
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn set_and_get_active_program() {
        let pool = setup_test_db().await;
        let created = seed_program(&pool).await;

        let activation = set_active_program_inner(
            &pool,
            "user-1".into(),
            created.program.id.clone(),
            Some("2025-01-06".into()),
        )
        .await
        .unwrap();

        assert_eq!(activation.program_id, created.program.id);
        assert_eq!(activation.start_date, "2025-01-06");
        assert_eq!(activation.current_block_ordinal, 1);
        assert_eq!(activation.current_week_number, 1);

        let fetched = get_active_program_inner(&pool, "user-1".into())
            .await
            .unwrap()
            .expect("should be Some");
        assert_eq!(fetched.program_id, created.program.id);
    }

    #[tokio::test]
    async fn set_active_program_replaces_existing() {
        let pool = setup_test_db().await;
        let p1 = seed_program(&pool).await;

        set_active_program_inner(
            &pool,
            "user-1".into(),
            p1.program.id.clone(),
            Some("2025-01-01".into()),
        )
        .await
        .unwrap();

        // Create a second program and activate it
        let mut p2_input = make_program_input(None);
        p2_input.name = "Program 2".into();
        let p2 = create_program_full_inner(&pool, p2_input, vec![])
            .await
            .unwrap();

        let activation = set_active_program_inner(
            &pool,
            "user-1".into(),
            p2.program.id.clone(),
            Some("2025-02-01".into()),
        )
        .await
        .unwrap();

        assert_eq!(activation.program_id, p2.program.id);
        assert_eq!(activation.start_date, "2025-02-01");
    }

    #[tokio::test]
    async fn clear_active_program_deletes_activation() {
        let pool = setup_test_db().await;
        let created = seed_program(&pool).await;

        set_active_program_inner(
            &pool,
            "user-1".into(),
            created.program.id,
            Some("2025-01-06".into()),
        )
        .await
        .unwrap();

        clear_active_program_inner(&pool, "user-1".into())
            .await
            .unwrap();

        let result = get_active_program_inner(&pool, "user-1".into())
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn clear_active_program_returns_not_found() {
        let pool = setup_test_db().await;

        let err = clear_active_program_inner(&pool, "nobody".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("not found"));
    }

    #[tokio::test]
    async fn get_active_program_returns_none_when_unset() {
        let pool = setup_test_db().await;

        let result = get_active_program_inner(&pool, "user-1".into())
            .await
            .unwrap();

        assert!(result.is_none());
    }
}
