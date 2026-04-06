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
    migrate_guest_data_inner(pool.inner(), old_user_id, new_user_id).await
}

pub(crate) async fn migrate_guest_data_inner(
    pool: &SqlitePool,
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

    // SAFETY: table names are compile-time string literals from the hardcoded
    // array above, never from user input. sqlx does not support parameterized
    // table identifiers, so format!() is the standard approach here.
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

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("pool");

        // Create all tables referenced by migrate_guest_data_inner
        for ddl in [
            "CREATE TABLE workout_logs (id TEXT PRIMARY KEY, user_id TEXT)",
            "CREATE TABLE logged_activity_groups (id TEXT PRIMARY KEY, user_id TEXT)",
            "CREATE TABLE logged_activities (id TEXT PRIMARY KEY, user_id TEXT)",
            "CREATE TABLE logged_sets (id TEXT PRIMARY KEY, user_id TEXT)",
            "CREATE TABLE one_rep_max_history (id TEXT PRIMARY KEY, user_id TEXT)",
            "CREATE TABLE session_templates (id TEXT PRIMARY KEY, user_id TEXT)",
            "CREATE TABLE programs (id TEXT PRIMARY KEY, user_id TEXT)",
            "CREATE TABLE program_activations (id TEXT PRIMARY KEY, user_id TEXT)",
            "CREATE TABLE user_profiles (id TEXT PRIMARY KEY, display_name TEXT)",
        ] {
            sqlx::query(ddl).execute(&pool).await.expect("ddl");
        }

        pool
    }

    #[tokio::test]
    async fn migrate_guest_data_moves_user_id_rows() {
        let pool = setup_test_db().await;

        // Seed guest data in two tables
        sqlx::query("INSERT INTO workout_logs (id, user_id) VALUES ('wl-1', 'guest-1')")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO session_templates (id, user_id) VALUES ('st-1', 'guest-1')")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO user_profiles (id, display_name) VALUES ('guest-1', 'Guest')")
            .execute(&pool)
            .await
            .unwrap();

        migrate_guest_data_inner(&pool, "guest-1".into(), "real-user".into())
            .await
            .unwrap();

        // Verify workout_logs migrated
        let row: (String,) = sqlx::query_as("SELECT user_id FROM workout_logs WHERE id = 'wl-1'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, "real-user");

        // Verify session_templates migrated
        let row: (String,) =
            sqlx::query_as("SELECT user_id FROM session_templates WHERE id = 'st-1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(row.0, "real-user");

        // Verify user_profiles id migrated
        let row: (String,) = sqlx::query_as("SELECT id FROM user_profiles WHERE id = 'real-user'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, "real-user");
    }

    #[tokio::test]
    async fn migrate_guest_data_no_op_when_no_guest_rows() {
        let pool = setup_test_db().await;
        // Should succeed without error even if no rows match
        migrate_guest_data_inner(&pool, "nonexistent".into(), "real-user".into())
            .await
            .unwrap();
    }
}
