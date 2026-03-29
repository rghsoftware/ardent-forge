use sqlx::SqlitePool;
use tauri::State;

use crate::error::AppError;

/// Migrate all guest user data to a newly authenticated user account.
///
/// This runs inside a single transaction so the migration is all-or-nothing.
/// Tables with a `user_id` column are updated directly. The `user_profiles`
/// table uses `id` as the user identifier, so it is handled separately.
#[tauri::command]
pub async fn migrate_guest_data(
    pool: State<'_, SqlitePool>,
    old_user_id: String,
    new_user_id: String,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;

    // Tables that store user_id as a foreign-key-style column
    let user_id_tables = [
        "workout_logs",
        "logged_activity_groups",
        "logged_activities",
        "logged_sets",
        "one_rep_max_history",
        "session_templates",
        "programs",
        "program_activations",
    ];

    for table in &user_id_tables {
        sqlx::query(&format!(
            "UPDATE {} SET user_id = ? WHERE user_id = ?",
            table
        ))
        .bind(&new_user_id)
        .bind(&old_user_id)
        .execute(&mut *tx)
        .await?;
    }

    // user_profiles uses `id` as the user identifier (not a separate user_id column)
    sqlx::query("UPDATE user_profiles SET id = ? WHERE id = ?")
        .bind(&new_user_id)
        .bind(&old_user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(())
}
