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
    get_app_config_inner(pool.inner(), key).await
}

pub(crate) async fn get_app_config_inner(
    pool: &SqlitePool,
    key: String,
) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_config WHERE key = ?")
        .bind(&key)
        .fetch_optional(pool)
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
    set_app_config_inner(pool.inner(), key, value).await
}

pub(crate) async fn set_app_config_inner(
    pool: &SqlitePool,
    key: String,
    value: String,
) -> Result<(), AppError> {
    sqlx::query("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)")
        .bind(&key)
        .bind(&value)
        .execute(pool)
        .await?;

    Ok(())
}

/// Deletes the entry for `key` from the `app_config` table. No-op if the key does not exist.
#[tauri::command]
pub async fn clear_app_config(pool: State<'_, SqlitePool>, key: String) -> Result<(), AppError> {
    clear_app_config_inner(pool.inner(), key).await
}

pub(crate) async fn clear_app_config_inner(pool: &SqlitePool, key: String) -> Result<(), AppError> {
    sqlx::query("DELETE FROM app_config WHERE key = ?")
        .bind(&key)
        .execute(pool)
        .await?;

    Ok(())
}

/// Deletes all rows from all sync-tracked tables. Requires `confirmation == "WIPE_CONFIRMED"` to prevent accidental data loss.
#[tauri::command]
pub async fn wipe_synced_data(
    pool: State<'_, SqlitePool>,
    confirmation: String,
) -> Result<(), AppError> {
    wipe_synced_data_inner(pool.inner(), confirmation).await
}

pub(crate) async fn wipe_synced_data_inner(
    pool: &SqlitePool,
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorKind;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("pool");
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS app_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .expect("ddl");
        pool
    }

    #[tokio::test]
    async fn get_returns_none_for_missing_key() {
        let pool = setup_test_db().await;
        let result = get_app_config_inner(&pool, "missing".into()).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn set_then_get_returns_value() {
        let pool = setup_test_db().await;
        set_app_config_inner(&pool, "theme".into(), "dark".into())
            .await
            .unwrap();
        let result = get_app_config_inner(&pool, "theme".into()).await.unwrap();
        assert_eq!(result.as_deref(), Some("dark"));
    }

    #[tokio::test]
    async fn set_overwrites_existing_value() {
        let pool = setup_test_db().await;
        set_app_config_inner(&pool, "lang".into(), "en".into())
            .await
            .unwrap();
        set_app_config_inner(&pool, "lang".into(), "es".into())
            .await
            .unwrap();
        let result = get_app_config_inner(&pool, "lang".into()).await.unwrap();
        assert_eq!(result.as_deref(), Some("es"));
    }

    #[tokio::test]
    async fn clear_removes_key() {
        let pool = setup_test_db().await;
        set_app_config_inner(&pool, "temp".into(), "val".into())
            .await
            .unwrap();
        clear_app_config_inner(&pool, "temp".into()).await.unwrap();
        let result = get_app_config_inner(&pool, "temp".into()).await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn clear_noop_for_missing_key() {
        let pool = setup_test_db().await;
        // Should not error on nonexistent key
        clear_app_config_inner(&pool, "nope".into()).await.unwrap();
    }

    #[tokio::test]
    async fn wipe_rejects_wrong_confirmation() {
        let pool = setup_test_db().await;
        let err = wipe_synced_data_inner(&pool, "wrong".into())
            .await
            .unwrap_err();
        assert!(matches!(err.kind, ErrorKind::Validation));
    }
}
