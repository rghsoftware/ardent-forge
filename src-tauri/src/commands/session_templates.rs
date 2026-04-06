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
// Commands (thin wrappers delegating to inner functions for testability)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_session_templates(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<SessionTemplateRow>, AppError> {
    get_session_templates_inner(pool.inner(), user_id).await
}

#[tauri::command]
pub async fn get_session_template(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<SessionTemplateRow>, AppError> {
    get_session_template_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn get_session_template_full(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<SessionTemplateFull>, AppError> {
    get_session_template_full_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn create_session_template_full(
    pool: State<'_, SqlitePool>,
    template: CreateSessionTemplateInput,
    groups: Vec<CreateActivityGroupFullInput>,
) -> Result<SessionTemplateFull, AppError> {
    create_session_template_full_inner(pool.inner(), template, groups).await
}

#[tauri::command]
pub async fn update_session_template_full(
    pool: State<'_, SqlitePool>,
    template: CreateSessionTemplateInput,
    groups: Vec<CreateActivityGroupFullInput>,
) -> Result<SessionTemplateFull, AppError> {
    update_session_template_full_inner(pool.inner(), template, groups).await
}

#[tauri::command]
pub async fn touch_session_template_last_assigned(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), AppError> {
    touch_session_template_last_assigned_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn delete_session_template(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<(), AppError> {
    delete_session_template_inner(pool.inner(), id).await
}

// ---------------------------------------------------------------------------
// Inner functions (testable, take &SqlitePool directly)
// ---------------------------------------------------------------------------

pub(crate) async fn get_session_templates_inner(
    pool: &SqlitePool,
    user_id: String,
) -> Result<Vec<SessionTemplateRow>, AppError> {
    let rows = sqlx::query_as::<_, SessionTemplateRow>(
        "SELECT * FROM session_templates WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub(crate) async fn get_session_template_inner(
    pool: &SqlitePool,
    id: String,
) -> Result<Option<SessionTemplateRow>, AppError> {
    let row =
        sqlx::query_as::<_, SessionTemplateRow>("SELECT * FROM session_templates WHERE id = ?")
            .bind(&id)
            .fetch_optional(pool)
            .await?;

    Ok(row)
}

pub(crate) async fn get_session_template_full_inner(
    pool: &SqlitePool,
    id: String,
) -> Result<Option<SessionTemplateFull>, AppError> {
    // Fetch the template
    let template =
        sqlx::query_as::<_, SessionTemplateRow>("SELECT * FROM session_templates WHERE id = ?")
            .bind(&id)
            .fetch_optional(pool)
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
    .fetch_all(pool)
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
    let activities = act_query.fetch_all(pool).await?;

    Ok(Some(SessionTemplateFull {
        template,
        groups,
        activities,
    }))
}

pub(crate) async fn create_session_template_full_inner(
    pool: &SqlitePool,
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

pub(crate) async fn update_session_template_full_inner(
    pool: &SqlitePool,
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

pub(crate) async fn touch_session_template_last_assigned_inner(
    pool: &SqlitePool,
    id: String,
) -> Result<(), AppError> {
    let now = now_unix();
    let result = sqlx::query("UPDATE session_templates SET last_assigned_at = ? WHERE id = ?")
        .bind(now)
        .bind(&id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("SessionTemplate", &id));
    }
    Ok(())
}

pub(crate) async fn delete_session_template_inner(
    pool: &SqlitePool,
    id: String,
) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM session_templates WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("SessionTemplate", &id));
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

    const SESSION_TEMPLATE_DDL: &str = "\
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
        CREATE TABLE IF NOT EXISTS activity_groups (\
            id TEXT PRIMARY KEY, \
            session_template_id TEXT NOT NULL REFERENCES session_templates(id) ON DELETE CASCADE, \
            group_type TEXT NOT NULL, \
            ordinal INTEGER NOT NULL, \
            rounds INTEGER, \
            rest_between_rounds TEXT, \
            rest_between_activities TEXT, \
            created_at INTEGER, \
            updated_at INTEGER\
        );\
        CREATE TABLE IF NOT EXISTS activities (\
            id TEXT PRIMARY KEY, \
            activity_group_id TEXT NOT NULL REFERENCES activity_groups(id) ON DELETE CASCADE, \
            exercise_id TEXT NOT NULL, \
            ordinal INTEGER NOT NULL, \
            set_scheme TEXT NOT NULL, \
            notes TEXT, \
            created_at INTEGER, \
            updated_at INTEGER\
        );";

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("in-memory pool");

        for stmt in SESSION_TEMPLATE_DDL.split(';') {
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

    fn make_template_input(id: Option<&str>) -> CreateSessionTemplateInput {
        CreateSessionTemplateInput {
            id: id.map(String::from),
            user_id: "user-1".into(),
            name: "Push Day".into(),
            description: Some("Chest + shoulders".into()),
            category: "strength".into(),
            rest_between_groups: Some(r#"{"seconds":120}"#.into()),
            time_cap: None,
            scoring: "none".into(),
        }
    }

    fn make_groups() -> Vec<CreateActivityGroupFullInput> {
        vec![CreateActivityGroupFullInput {
            group: CreateActivityGroupInput {
                id: None,
                group_type: "standard".into(),
                ordinal: 0,
                rounds: Some(3),
                rest_between_rounds: None,
                rest_between_activities: None,
            },
            activities: vec![CreateActivityInput {
                id: None,
                exercise_id: "ex-bench".into(),
                ordinal: 0,
                set_scheme: r#"{"sets":3,"reps":5}"#.into(),
                notes: None,
            }],
        }]
    }

    /// Creates a template via create_session_template_full_inner and returns it.
    async fn seed_template(pool: &SqlitePool) -> SessionTemplateFull {
        create_session_template_full_inner(pool, make_template_input(None), make_groups())
            .await
            .expect("seed template")
    }

    // -----------------------------------------------------------------------
    // get_session_templates
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_session_templates_returns_user_templates() {
        let pool = setup_test_db().await;
        seed_template(&pool).await;

        let rows = get_session_templates_inner(&pool, "user-1".into())
            .await
            .unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "Push Day");
    }

    #[tokio::test]
    async fn get_session_templates_returns_empty_for_unknown_user() {
        let pool = setup_test_db().await;

        let rows = get_session_templates_inner(&pool, "nobody".into())
            .await
            .unwrap();

        assert!(rows.is_empty());
    }

    // -----------------------------------------------------------------------
    // get_session_template_full
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_session_template_full_returns_nested_data() {
        let pool = setup_test_db().await;
        let created = seed_template(&pool).await;

        let full = get_session_template_full_inner(&pool, created.template.id.clone())
            .await
            .unwrap()
            .expect("should be Some");

        assert_eq!(full.template.id, created.template.id);
        assert_eq!(full.groups.len(), 1);
        assert_eq!(full.activities.len(), 1);
        assert_eq!(full.activities[0].exercise_id, "ex-bench");
    }

    #[tokio::test]
    async fn get_session_template_full_returns_none_for_missing() {
        let pool = setup_test_db().await;

        let result = get_session_template_full_inner(&pool, "nonexistent".into())
            .await
            .unwrap();

        assert!(result.is_none());
    }

    // -----------------------------------------------------------------------
    // create_session_template_full
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn create_session_template_full_persists_all_rows() {
        let pool = setup_test_db().await;

        let result =
            create_session_template_full_inner(&pool, make_template_input(None), make_groups())
                .await
                .unwrap();

        assert_eq!(result.template.name, "Push Day");
        assert_eq!(result.template.category, "strength");
        assert_eq!(result.groups.len(), 1);
        assert_eq!(result.groups[0].group_type, "standard");
        assert_eq!(result.groups[0].rounds, Some(3));
        assert_eq!(result.activities.len(), 1);
        assert_eq!(result.activities[0].set_scheme, r#"{"sets":3,"reps":5}"#);
    }

    #[tokio::test]
    async fn create_session_template_full_rejects_invalid_set_scheme() {
        let pool = setup_test_db().await;
        let bad_groups = vec![CreateActivityGroupFullInput {
            group: CreateActivityGroupInput {
                id: None,
                group_type: "standard".into(),
                ordinal: 0,
                rounds: None,
                rest_between_rounds: None,
                rest_between_activities: None,
            },
            activities: vec![CreateActivityInput {
                id: None,
                exercise_id: "ex-1".into(),
                ordinal: 0,
                set_scheme: "not json".into(),
                notes: None,
            }],
        }];

        let err = create_session_template_full_inner(&pool, make_template_input(None), bad_groups)
            .await
            .unwrap_err();

        assert!(err.message.contains("Invalid JSON"));
    }

    // -----------------------------------------------------------------------
    // update_session_template_full
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn update_session_template_full_replaces_groups() {
        let pool = setup_test_db().await;
        let created = seed_template(&pool).await;
        let tid = created.template.id.clone();

        // Update with a new group containing two activities
        let new_groups = vec![CreateActivityGroupFullInput {
            group: CreateActivityGroupInput {
                id: None,
                group_type: "superset".into(),
                ordinal: 0,
                rounds: Some(4),
                rest_between_rounds: None,
                rest_between_activities: None,
            },
            activities: vec![
                CreateActivityInput {
                    id: None,
                    exercise_id: "ex-squat".into(),
                    ordinal: 0,
                    set_scheme: r#"{"sets":5,"reps":5}"#.into(),
                    notes: None,
                },
                CreateActivityInput {
                    id: None,
                    exercise_id: "ex-lunge".into(),
                    ordinal: 1,
                    set_scheme: r#"{"sets":3,"reps":10}"#.into(),
                    notes: Some("each leg".into()),
                },
            ],
        }];

        let mut updated_input = make_template_input(Some(&tid));
        updated_input.name = "Leg Day".into();

        let updated = update_session_template_full_inner(&pool, updated_input, new_groups)
            .await
            .unwrap();

        assert_eq!(updated.template.name, "Leg Day");
        assert_eq!(updated.groups.len(), 1);
        assert_eq!(updated.groups[0].group_type, "superset");
        assert_eq!(updated.activities.len(), 2);
    }

    #[tokio::test]
    async fn update_session_template_full_rejects_missing_id() {
        let pool = setup_test_db().await;

        let err =
            update_session_template_full_inner(&pool, make_template_input(None), make_groups())
                .await
                .unwrap_err();

        assert!(err.message.contains("required for update"));
    }

    // -----------------------------------------------------------------------
    // delete_session_template
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn delete_session_template_removes_template() {
        let pool = setup_test_db().await;
        let created = seed_template(&pool).await;

        delete_session_template_inner(&pool, created.template.id.clone())
            .await
            .unwrap();

        let result = get_session_template_inner(&pool, created.template.id)
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn delete_session_template_returns_not_found() {
        let pool = setup_test_db().await;

        let err = delete_session_template_inner(&pool, "nonexistent".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("not found"));
    }

    // -----------------------------------------------------------------------
    // touch_session_template_last_assigned
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn touch_last_assigned_updates_timestamp() {
        let pool = setup_test_db().await;
        let created = seed_template(&pool).await;
        let tid = created.template.id.clone();

        assert!(created.template.last_assigned_at.is_none());

        touch_session_template_last_assigned_inner(&pool, tid.clone())
            .await
            .unwrap();

        let row = get_session_template_inner(&pool, tid)
            .await
            .unwrap()
            .expect("should exist");
        assert!(row.last_assigned_at.is_some());
    }
}
