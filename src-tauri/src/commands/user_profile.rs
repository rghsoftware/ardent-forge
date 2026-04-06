use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{OneRepMaxHistoryRow, UserProfileRow};
use crate::utils::now_unix;

// ---------------------------------------------------------------------------
// Input structs
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
pub struct UpdateUserProfileInput {
    pub id: String,
    pub display_name: Option<String>,
    pub preferred_units: Option<String>,
    pub bodyweight: Option<String>,
    pub training_age: Option<String>,
    pub exercise_maxes: Option<String>,
    pub max_reps: Option<String>,
    pub display_visible: Option<bool>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_user_profile(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Option<UserProfileRow>, AppError> {
    get_user_profile_inner(pool.inner(), user_id).await
}

pub(crate) async fn get_user_profile_inner(
    pool: &SqlitePool,
    user_id: String,
) -> Result<Option<UserProfileRow>, AppError> {
    let row = sqlx::query_as::<_, UserProfileRow>("SELECT * FROM user_profiles WHERE id = ?")
        .bind(&user_id)
        .fetch_optional(pool)
        .await?;

    Ok(row)
}

#[tauri::command]
pub async fn update_user_profile(
    pool: State<'_, SqlitePool>,
    profile: UpdateUserProfileInput,
) -> Result<UserProfileRow, AppError> {
    update_user_profile_inner(pool.inner(), profile).await
}

pub(crate) async fn update_user_profile_inner(
    pool: &SqlitePool,
    profile: UpdateUserProfileInput,
) -> Result<UserProfileRow, AppError> {
    let now = now_unix();

    let mut tx = pool.begin().await?;

    // UPSERT: insert if not exists, update if exists
    let display_visible_int = profile.display_visible.map(|b| if b { 1i64 } else { 0i64 });

    sqlx::query(
        "INSERT INTO user_profiles \
         (id, display_name, preferred_units, bodyweight, training_age, \
          exercise_maxes, max_reps, display_visible, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT(id) DO UPDATE SET \
         display_name = excluded.display_name, \
         preferred_units = excluded.preferred_units, \
         bodyweight = excluded.bodyweight, \
         training_age = excluded.training_age, \
         exercise_maxes = excluded.exercise_maxes, \
         max_reps = excluded.max_reps, \
         display_visible = excluded.display_visible, \
         updated_at = excluded.updated_at",
    )
    .bind(&profile.id)
    .bind(&profile.display_name)
    .bind(&profile.preferred_units)
    .bind(&profile.bodyweight)
    .bind(&profile.training_age)
    .bind(&profile.exercise_maxes)
    .bind(&profile.max_reps)
    .bind(display_visible_int)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    let row = sqlx::query_as::<_, UserProfileRow>("SELECT * FROM user_profiles WHERE id = ?")
        .bind(&profile.id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(row)
}

#[tauri::command]
pub async fn save_one_rep_max(
    pool: State<'_, SqlitePool>,
    user_id: String,
    exercise_id: String,
    weight: String,
    estimated: Option<bool>,
    recorded_at: i64,
) -> Result<OneRepMaxHistoryRow, AppError> {
    save_one_rep_max_inner(
        pool.inner(),
        user_id,
        exercise_id,
        weight,
        estimated,
        recorded_at,
    )
    .await
}

pub(crate) async fn save_one_rep_max_inner(
    pool: &SqlitePool,
    user_id: String,
    exercise_id: String,
    weight: String,
    estimated: Option<bool>,
    recorded_at: i64,
) -> Result<OneRepMaxHistoryRow, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();
    let estimated_int = estimated.map(|b| if b { 1i32 } else { 0 });

    let mut tx = pool.begin().await?;

    sqlx::query(
        "INSERT INTO one_rep_max_history \
         (id, user_id, exercise_id, weight, estimated, recorded_at, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&user_id)
    .bind(&exercise_id)
    .bind(&weight)
    .bind(estimated_int)
    .bind(recorded_at)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    let row =
        sqlx::query_as::<_, OneRepMaxHistoryRow>("SELECT * FROM one_rep_max_history WHERE id = ?")
            .bind(&id)
            .fetch_one(&mut *tx)
            .await?;

    tx.commit().await?;

    Ok(row)
}

#[tauri::command]
pub async fn get_one_rep_max_history(
    pool: State<'_, SqlitePool>,
    user_id: String,
    exercise_id: String,
) -> Result<Vec<OneRepMaxHistoryRow>, AppError> {
    get_one_rep_max_history_inner(pool.inner(), user_id, exercise_id).await
}

pub(crate) async fn get_one_rep_max_history_inner(
    pool: &SqlitePool,
    user_id: String,
    exercise_id: String,
) -> Result<Vec<OneRepMaxHistoryRow>, AppError> {
    let rows = sqlx::query_as::<_, OneRepMaxHistoryRow>(
        "SELECT * FROM one_rep_max_history \
         WHERE user_id = ? AND exercise_id = ? \
         ORDER BY recorded_at ASC",
    )
    .bind(&user_id)
    .bind(&exercise_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("pool");
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS user_profiles (
                id TEXT PRIMARY KEY,
                display_name TEXT,
                preferred_units TEXT,
                bodyweight TEXT,
                training_age TEXT,
                exercise_maxes TEXT,
                max_reps TEXT,
                display_visible INTEGER DEFAULT 1,
                created_at INTEGER,
                updated_at INTEGER
            )",
        )
        .execute(&pool)
        .await
        .expect("ddl user_profiles");

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS one_rep_max_history (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                exercise_id TEXT NOT NULL,
                weight TEXT NOT NULL,
                estimated INTEGER,
                recorded_at INTEGER NOT NULL,
                created_at INTEGER
            )",
        )
        .execute(&pool)
        .await
        .expect("ddl one_rep_max_history");

        pool
    }

    fn profile_input(id: &str) -> UpdateUserProfileInput {
        UpdateUserProfileInput {
            id: id.to_string(),
            display_name: Some("Test User".to_string()),
            preferred_units: Some("IMPERIAL".to_string()),
            bodyweight: None,
            training_age: None,
            exercise_maxes: None,
            max_reps: None,
            display_visible: Some(true),
        }
    }

    #[tokio::test]
    async fn get_profile_returns_none_when_missing() {
        let pool = setup_test_db().await;
        let result = get_user_profile_inner(&pool, "nonexistent".into())
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn upsert_creates_and_updates_profile() {
        let pool = setup_test_db().await;

        // Create via upsert
        let created = update_user_profile_inner(&pool, profile_input("user-1"))
            .await
            .unwrap();
        assert_eq!(created.id, "user-1");
        assert_eq!(created.display_name.as_deref(), Some("Test User"));

        // Update via upsert
        let mut updated_input = profile_input("user-1");
        updated_input.display_name = Some("Updated Name".to_string());
        let updated = update_user_profile_inner(&pool, updated_input)
            .await
            .unwrap();
        assert_eq!(updated.display_name.as_deref(), Some("Updated Name"));
    }

    #[tokio::test]
    async fn save_and_get_one_rep_max_history() {
        let pool = setup_test_db().await;

        let row = save_one_rep_max_inner(
            &pool,
            "user-1".into(),
            "ex-1".into(),
            r#"{"value":100,"unit":"LB"}"#.into(),
            Some(false),
            1700000000,
        )
        .await
        .unwrap();
        assert_eq!(row.user_id, "user-1");
        assert_eq!(row.exercise_id, "ex-1");

        let history = get_one_rep_max_history_inner(&pool, "user-1".into(), "ex-1".into())
            .await
            .unwrap();
        assert_eq!(history.len(), 1);
    }

    #[tokio::test]
    async fn get_one_rep_max_history_returns_empty() {
        let pool = setup_test_db().await;
        let result = get_one_rep_max_history_inner(&pool, "user-1".into(), "ex-1".into())
            .await
            .unwrap();
        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn one_rep_max_history_ordered_by_recorded_at() {
        let pool = setup_test_db().await;

        save_one_rep_max_inner(
            &pool,
            "u1".into(),
            "e1".into(),
            r#"{"value":200,"unit":"LB"}"#.into(),
            None,
            1700000200,
        )
        .await
        .unwrap();

        save_one_rep_max_inner(
            &pool,
            "u1".into(),
            "e1".into(),
            r#"{"value":100,"unit":"LB"}"#.into(),
            None,
            1700000100,
        )
        .await
        .unwrap();

        let history = get_one_rep_max_history_inner(&pool, "u1".into(), "e1".into())
            .await
            .unwrap();
        assert_eq!(history.len(), 2);
        assert!(history[0].recorded_at < history[1].recorded_at);
    }
}
