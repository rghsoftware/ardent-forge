//! Key-value config store backed by the `app_config` SQLite table. Not synced to Supabase.

use sqlx::SqlitePool;
use tauri::State;

use crate::error::AppError;
use crate::sync::SYNCABLE_TABLES;

/// Retrieves the value for `key` from the `app_config` table. Returns `None` if the key does not exist.
#[tauri::command]
pub async fn get_app_config(
    pool: State<'_, SqlitePool>,
    key: String,
) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_config WHERE key = ?")
        .bind(&key)
        .fetch_optional(pool.inner())
        .await?;

    Ok(row.map(|(v,)| v))
}

/// Inserts or updates the value for `key` in the `app_config` table (upsert).
#[tauri::command]
pub async fn set_app_config(
    pool: State<'_, SqlitePool>,
    key: String,
    value: String,
) -> Result<(), AppError> {
    sqlx::query("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)")
        .bind(&key)
        .bind(&value)
        .execute(pool.inner())
        .await?;

    Ok(())
}

/// Deletes the entry for `key` from the `app_config` table. No-op if the key does not exist.
#[tauri::command]
pub async fn clear_app_config(pool: State<'_, SqlitePool>, key: String) -> Result<(), AppError> {
    sqlx::query("DELETE FROM app_config WHERE key = ?")
        .bind(&key)
        .execute(pool.inner())
        .await?;

    Ok(())
}

/// Deletes all rows from all sync-tracked tables. Requires `confirmation == "WIPE_CONFIRMED"` to prevent accidental data loss.
#[tauri::command]
pub async fn wipe_synced_data(
    pool: State<'_, SqlitePool>,
    confirmation: String,
) -> Result<(), AppError> {
    if confirmation != "WIPE_CONFIRMED" {
        return Err(AppError::validation(
            "confirmation",
            "Invalid confirmation string. Pass 'WIPE_CONFIRMED' to proceed.",
        ));
    }

    let mut tx = pool.begin().await?;

    for table in SYNCABLE_TABLES {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&mut *tx)
            .await?;
    }

    sqlx::query("DELETE FROM sync_queue")
        .execute(&mut *tx)
        .await?;

    sqlx::query("DELETE FROM sync_metadata")
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(())
}
