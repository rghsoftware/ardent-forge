use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::models::{
    OneRepMaxHistoryResponse, OneRepMaxHistoryRow, UserProfileResponse, UserProfileRow,
};
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
) -> Result<Option<UserProfileResponse>, String> {
    let row = sqlx::query_as::<_, UserProfileRow>("SELECT * FROM user_profiles WHERE id = ?")
        .bind(&user_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(row.map(UserProfileResponse::from))
}

#[tauri::command]
pub async fn update_user_profile(
    pool: State<'_, SqlitePool>,
    profile: UpdateUserProfileInput,
) -> Result<UserProfileResponse, String> {
    let now = now_unix();

    // UPSERT: insert if not exists, update if exists
    sqlx::query(
        "INSERT INTO user_profiles \
         (id, display_name, preferred_units, bodyweight, training_age, \
          exercise_maxes, max_reps, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT(id) DO UPDATE SET \
         display_name = COALESCE(excluded.display_name, user_profiles.display_name), \
         preferred_units = COALESCE(excluded.preferred_units, user_profiles.preferred_units), \
         bodyweight = COALESCE(excluded.bodyweight, user_profiles.bodyweight), \
         training_age = COALESCE(excluded.training_age, user_profiles.training_age), \
         exercise_maxes = COALESCE(excluded.exercise_maxes, user_profiles.exercise_maxes), \
         max_reps = COALESCE(excluded.max_reps, user_profiles.max_reps), \
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
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query_as::<_, UserProfileRow>("SELECT * FROM user_profiles WHERE id = ?")
        .bind(&profile.id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(UserProfileResponse::from(row))
}

#[tauri::command]
pub async fn save_one_rep_max(
    pool: State<'_, SqlitePool>,
    user_id: String,
    exercise_id: String,
    weight: String,
    estimated: Option<bool>,
    recorded_at: i64,
) -> Result<OneRepMaxHistoryResponse, String> {
    let id = Uuid::new_v4().to_string();
    let now = now_unix();
    let estimated_int = estimated.map(|b| if b { 1i32 } else { 0 });

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
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let row = sqlx::query_as::<_, OneRepMaxHistoryRow>(
        "SELECT * FROM one_rep_max_history WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(OneRepMaxHistoryResponse::from(row))
}

#[tauri::command]
pub async fn get_one_rep_max_history(
    pool: State<'_, SqlitePool>,
    user_id: String,
    exercise_id: String,
) -> Result<Vec<OneRepMaxHistoryResponse>, String> {
    let rows = sqlx::query_as::<_, OneRepMaxHistoryRow>(
        "SELECT * FROM one_rep_max_history \
         WHERE user_id = ? AND exercise_id = ? \
         ORDER BY recorded_at ASC",
    )
    .bind(&user_id)
    .bind(&exercise_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(OneRepMaxHistoryResponse::from).collect())
}
