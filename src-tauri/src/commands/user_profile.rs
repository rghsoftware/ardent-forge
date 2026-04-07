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
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_user_profile(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Option<UserProfileRow>, AppError> {
    let row = sqlx::query_as::<_, UserProfileRow>("SELECT * FROM user_profiles WHERE id = ?")
        .bind(&user_id)
        .fetch_optional(pool.inner())
        .await?;

    Ok(row)
}

#[tauri::command]
pub async fn update_user_profile(
    pool: State<'_, SqlitePool>,
    profile: UpdateUserProfileInput,
) -> Result<UserProfileRow, AppError> {
    let now = now_unix();

    let mut tx = pool.begin().await?;

    // UPSERT: insert if not exists, update if exists
    sqlx::query(
        "INSERT INTO user_profiles \
         (id, display_name, preferred_units, bodyweight, training_age, \
          exercise_maxes, max_reps, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT(id) DO UPDATE SET \
         display_name = excluded.display_name, \
         preferred_units = excluded.preferred_units, \
         bodyweight = excluded.bodyweight, \
         training_age = excluded.training_age, \
         exercise_maxes = excluded.exercise_maxes, \
         max_reps = excluded.max_reps, \
         updated_at = excluded.updated_at",
    )
    .bind(&profile.id)
    .bind(&profile.display_name)
    .bind(&profile.preferred_units)
    .bind(&profile.bodyweight)
    .bind(&profile.training_age)
    .bind(&profile.exercise_maxes)
    .bind(&profile.max_reps)
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
    let rows = sqlx::query_as::<_, OneRepMaxHistoryRow>(
        "SELECT * FROM one_rep_max_history \
         WHERE user_id = ? AND exercise_id = ? \
         ORDER BY recorded_at ASC",
    )
    .bind(&user_id)
    .bind(&exercise_id)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}
