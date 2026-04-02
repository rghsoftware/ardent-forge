use serde_json;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{ActivityGroupRow, ActivityRow, SessionTemplateFull, SessionTemplateRow};
use crate::utils::now_unix;

// ---------------------------------------------------------------------------
// Input structs
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
pub struct CreateSessionTemplateInput {
    pub id: Option<String>,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub rest_between_groups: Option<String>,
    pub time_cap: Option<String>,
    pub scoring: String,
}

#[derive(serde::Deserialize)]
pub struct CreateActivityGroupFullInput {
    pub group: CreateActivityGroupInput,
    pub activities: Vec<CreateActivityInput>,
}

#[derive(serde::Deserialize)]
pub struct CreateActivityGroupInput {
    pub id: Option<String>,
    pub group_type: String,
    pub ordinal: i32,
    pub rounds: Option<i32>,
    pub rest_between_rounds: Option<String>,
    pub rest_between_activities: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct CreateActivityInput {
    pub id: Option<String>,
    pub exercise_id: String,
    pub ordinal: i32,
    pub set_scheme: String,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Lists all session templates owned by the given user.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `user_id`: The owner's user ID to filter templates by.
///
/// # Returns
/// A vector of `SessionTemplateRow` ordered by creation date descending.
#[tauri::command]
pub async fn get_session_templates(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<SessionTemplateRow>, AppError> {
    let rows = sqlx::query_as::<_, SessionTemplateRow>(
        "SELECT * FROM session_templates WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(&user_id)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}

/// Fetches a single session template by its ID.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `id`: The template's unique identifier.
///
/// # Returns
/// `Some(SessionTemplateRow)` if found, or `None` if no template matches the ID.
#[tauri::command]
pub async fn get_session_template(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<SessionTemplateRow>, AppError> {
    let row =
        sqlx::query_as::<_, SessionTemplateRow>("SELECT * FROM session_templates WHERE id = ?")
            .bind(&id)
            .fetch_optional(pool.inner())
            .await?;

    Ok(row)
}

/// Fetches a session template with all its activity groups and activities.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `id`: The template's unique identifier.
///
/// # Returns
/// `Some(SessionTemplateFull)` containing the template, its groups, and their
/// activities, or `None` if no template matches the ID.
#[tauri::command]
pub async fn get_session_template_full(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<SessionTemplateFull>, AppError> {
    // Fetch the template
    let template =
        sqlx::query_as::<_, SessionTemplateRow>("SELECT * FROM session_templates WHERE id = ?")
            .bind(&id)
            .fetch_optional(pool.inner())
            .await?;

    let template = match template {
        Some(t) => t,
        None => return Ok(None),
    };

    // Fetch groups
    let groups = sqlx::query_as::<_, ActivityGroupRow>(
        "SELECT * FROM activity_groups WHERE session_template_id = ? ORDER BY ordinal",
    )
    .bind(&id)
    .fetch_all(pool.inner())
    .await?;

    let group_ids: Vec<String> = groups.iter().map(|g| g.id.clone()).collect();

    if group_ids.is_empty() {
        return Ok(Some(SessionTemplateFull {
            template,
            groups: Vec::new(),
            activities: Vec::new(),
        }));
    }

    // Fetch activities for all groups
    let placeholders = group_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let act_sql = format!(
        "SELECT * FROM activities WHERE activity_group_id IN ({placeholders}) ORDER BY ordinal"
    );
    let mut act_query = sqlx::query_as::<_, ActivityRow>(&act_sql);
    for gid in &group_ids {
        act_query = act_query.bind(gid);
    }
    let activities = act_query.fetch_all(pool.inner()).await?;

    Ok(Some(SessionTemplateFull {
        template,
        groups,
        activities,
    }))
}

/// Creates a new session template with all its activity groups and activities
/// in a single transaction.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `template`: The session template header (name, category, scoring, etc.).
/// - `groups`: A vector of activity groups, each containing its child activities
///   with validated JSON `set_scheme` fields.
///
/// # Returns
/// The fully created `SessionTemplateFull` with all generated IDs and timestamps.
#[tauri::command]
pub async fn create_session_template_full(
    pool: State<'_, SqlitePool>,
    template: CreateSessionTemplateInput,
    groups: Vec<CreateActivityGroupFullInput>,
) -> Result<SessionTemplateFull, AppError> {
    // Validate set_scheme JSON for every activity before touching the database
    for group_input in &groups {
        for act_input in &group_input.activities {
            serde_json::from_str::<serde_json::Value>(&act_input.set_scheme)
                .map_err(|e| AppError::validation("set_scheme", &format!("Invalid JSON: {e}")))?;
        }
    }

    let template_id = template
        .id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = now_unix();

    let mut tx = pool.begin().await?;

    // Insert template
    sqlx::query(
        "INSERT INTO session_templates \
         (id, user_id, name, description, category, rest_between_groups, \
          time_cap, scoring, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&template_id)
    .bind(&template.user_id)
    .bind(&template.name)
    .bind(&template.description)
    .bind(&template.category)
    .bind(&template.rest_between_groups)
    .bind(&template.time_cap)
    .bind(&template.scoring)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    let mut all_groups: Vec<ActivityGroupRow> = Vec::new();
    let mut all_activities: Vec<ActivityRow> = Vec::new();

    for group_input in &groups {
        let group_id = group_input
            .group
            .id
            .as_ref()
            .filter(|s| !s.is_empty())
            .cloned()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        sqlx::query(
            "INSERT INTO activity_groups \
             (id, session_template_id, group_type, ordinal, rounds, \
              rest_between_rounds, rest_between_activities, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&group_id)
        .bind(&template_id)
        .bind(&group_input.group.group_type)
        .bind(group_input.group.ordinal)
        .bind(group_input.group.rounds)
        .bind(&group_input.group.rest_between_rounds)
        .bind(&group_input.group.rest_between_activities)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        let group_row =
            sqlx::query_as::<_, ActivityGroupRow>("SELECT * FROM activity_groups WHERE id = ?")
                .bind(&group_id)
                .fetch_one(&mut *tx)
                .await?;
        all_groups.push(group_row);

        for act_input in &group_input.activities {
            let act_id = act_input
                .id
                .as_ref()
                .filter(|s| !s.is_empty())
                .cloned()
                .unwrap_or_else(|| Uuid::new_v4().to_string());

            sqlx::query(
                "INSERT INTO activities \
                 (id, activity_group_id, exercise_id, ordinal, set_scheme, notes, \
                  created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&act_id)
            .bind(&group_id)
            .bind(&act_input.exercise_id)
            .bind(act_input.ordinal)
            .bind(&act_input.set_scheme)
            .bind(&act_input.notes)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await?;

            let act_row = sqlx::query_as::<_, ActivityRow>("SELECT * FROM activities WHERE id = ?")
                .bind(&act_id)
                .fetch_one(&mut *tx)
                .await?;
            all_activities.push(act_row);
        }
    }

    let template_row =
        sqlx::query_as::<_, SessionTemplateRow>("SELECT * FROM session_templates WHERE id = ?")
            .bind(&template_id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;

    Ok(SessionTemplateFull {
        template: template_row,
        groups: all_groups,
        activities: all_activities,
    })
}

/// Updates an existing session template by replacing all its activity groups
/// and activities in a single transaction. Existing groups and activities are
/// deleted (via ON DELETE CASCADE) and re-inserted from the provided input.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `template`: The updated template header; `id` is required.
/// - `groups`: The full replacement set of activity groups and their activities
///   with validated JSON `set_scheme` fields.
///
/// # Returns
/// The fully updated `SessionTemplateFull`, or an error if the template ID is
/// missing or the template does not exist.
#[tauri::command]
pub async fn update_session_template_full(
    pool: State<'_, SqlitePool>,
    template: CreateSessionTemplateInput,
    groups: Vec<CreateActivityGroupFullInput>,
) -> Result<SessionTemplateFull, AppError> {
    // Validate set_scheme JSON for every activity before touching the database
    for group_input in &groups {
        for act_input in &group_input.activities {
            serde_json::from_str::<serde_json::Value>(&act_input.set_scheme)
                .map_err(|e| AppError::validation("set_scheme", &format!("Invalid JSON: {e}")))?;
        }
    }

    let template_id = template
        .id
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::validation("id", "Template id is required for update"))?;
    let now = now_unix();

    let mut tx = pool.begin().await?;

    // Update template
    let result = sqlx::query(
        "UPDATE session_templates SET \
         user_id = ?, name = ?, description = ?, category = ?, \
         rest_between_groups = ?, time_cap = ?, scoring = ?, updated_at = ? \
         WHERE id = ?",
    )
    .bind(&template.user_id)
    .bind(&template.name)
    .bind(&template.description)
    .bind(&template.category)
    .bind(&template.rest_between_groups)
    .bind(&template.time_cap)
    .bind(&template.scoring)
    .bind(now)
    .bind(&template_id)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("SessionTemplate", &template_id));
    }

    // Delete existing groups (cascades to activities via FK ON DELETE CASCADE)
    sqlx::query("DELETE FROM activity_groups WHERE session_template_id = ?")
        .bind(&template_id)
        .execute(&mut *tx)
        .await?;

    // Re-insert all groups and activities
    let mut all_groups: Vec<ActivityGroupRow> = Vec::new();
    let mut all_activities: Vec<ActivityRow> = Vec::new();

    for group_input in &groups {
        let group_id = group_input
            .group
            .id
            .as_ref()
            .filter(|s| !s.is_empty())
            .cloned()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        sqlx::query(
            "INSERT INTO activity_groups \
             (id, session_template_id, group_type, ordinal, rounds, \
              rest_between_rounds, rest_between_activities, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&group_id)
        .bind(&template_id)
        .bind(&group_input.group.group_type)
        .bind(group_input.group.ordinal)
        .bind(group_input.group.rounds)
        .bind(&group_input.group.rest_between_rounds)
        .bind(&group_input.group.rest_between_activities)
        .bind(now)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        let group_row =
            sqlx::query_as::<_, ActivityGroupRow>("SELECT * FROM activity_groups WHERE id = ?")
                .bind(&group_id)
                .fetch_one(&mut *tx)
                .await?;
        all_groups.push(group_row);

        for act_input in &group_input.activities {
            let act_id = act_input
                .id
                .as_ref()
                .filter(|s| !s.is_empty())
                .cloned()
                .unwrap_or_else(|| Uuid::new_v4().to_string());

            sqlx::query(
                "INSERT INTO activities \
                 (id, activity_group_id, exercise_id, ordinal, set_scheme, notes, \
                  created_at, updated_at) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&act_id)
            .bind(&group_id)
            .bind(&act_input.exercise_id)
            .bind(act_input.ordinal)
            .bind(&act_input.set_scheme)
            .bind(&act_input.notes)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await?;

            let act_row = sqlx::query_as::<_, ActivityRow>("SELECT * FROM activities WHERE id = ?")
                .bind(&act_id)
                .fetch_one(&mut *tx)
                .await?;
            all_activities.push(act_row);
        }
    }

    let template_row =
        sqlx::query_as::<_, SessionTemplateRow>("SELECT * FROM session_templates WHERE id = ?")
            .bind(&template_id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;

    Ok(SessionTemplateFull {
        template: template_row,
        groups: all_groups,
        activities: all_activities,
    })
}

/// Deletes a session template and all its associated activity groups and
/// activities (cascaded via foreign key constraints).
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `id`: The template's unique identifier.
///
/// # Returns
/// `Ok(())` on success, or a not-found error if no template matches the ID.
#[tauri::command]
pub async fn delete_session_template(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM session_templates WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("SessionTemplate", &id));
    }
    Ok(())
}
