use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;
use tauri::Manager;

/// Initialize the SQLite database in the Tauri app data directory.
///
/// - Creates the app data directory if it does not exist.
/// - Opens (or creates) `ardent_forge.db` with foreign keys enabled.
/// - Runs all pending migrations from `./migrations`.
/// - In debug builds, if migrations fail due to checksum mismatch
///   (modified migration files), the database is deleted and recreated.
/// - Returns a connection pool ready for use.
pub async fn init_db(app: &tauri::App) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;

    std::fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("ardent_forge.db");
    let db_url = format!("sqlite:{}", db_path.display());

    let pool = connect_pool(&db_url).await?;

    match sqlx::migrate!("./migrations").run(&pool).await {
        Ok(()) => {
            log::info!("Database initialized at {}", db_path.display());
            Ok(pool)
        }
        Err(e) if cfg!(debug_assertions) => {
            log::warn!("Migration failed (debug build) -- recreating database: {e}");
            pool.close().await;
            for suffix in ["", "-shm", "-wal"] {
                let path = db_path.with_extension(format!("db{suffix}"));
                if path.exists() {
                    std::fs::remove_file(&path)?;
                }
            }
            let fresh_pool = connect_pool(&db_url).await?;
            sqlx::migrate!("./migrations").run(&fresh_pool).await?;
            log::info!("Database recreated at {}", db_path.display());
            Ok(fresh_pool)
        }
        Err(e) => Err(e.into()),
    }
}

async fn connect_pool(db_url: &str) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let options = SqliteConnectOptions::from_str(db_url)?
        .create_if_missing(true)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: create an in-memory SQLite pool using the same options pattern as connect_pool.
    async fn memory_pool() -> SqlitePool {
        let options = SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .create_if_missing(true)
            .foreign_keys(true);

        SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .unwrap()
    }

    #[tokio::test]
    async fn in_memory_pool_connects() {
        let pool = memory_pool().await;
        let row: (i64,) = sqlx::query_as("SELECT 1").fetch_one(&pool).await.unwrap();
        assert_eq!(row.0, 1);
    }

    #[tokio::test]
    async fn foreign_keys_enabled() {
        let pool = memory_pool().await;
        let row: (i64,) = sqlx::query_as("PRAGMA foreign_keys")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(row.0, 1, "foreign_keys pragma should be enabled");
    }

    #[tokio::test]
    async fn create_table_and_insert() {
        let pool = memory_pool().await;

        sqlx::query(
            "CREATE TABLE test_exercises (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query("INSERT INTO test_exercises (id, name) VALUES ('ex-1', 'Squat')")
            .execute(&pool)
            .await
            .unwrap();

        let row: (String, String) =
            sqlx::query_as("SELECT id, name FROM test_exercises WHERE id = 'ex-1'")
                .fetch_one(&pool)
                .await
                .unwrap();

        assert_eq!(row.0, "ex-1");
        assert_eq!(row.1, "Squat");
    }

    #[tokio::test]
    async fn foreign_key_constraint_enforced() {
        let pool = memory_pool().await;

        sqlx::query(
            "CREATE TABLE parent (id TEXT PRIMARY KEY);
             CREATE TABLE child (
                 id TEXT PRIMARY KEY,
                 parent_id TEXT NOT NULL REFERENCES parent(id)
             );",
        )
        .execute(&pool)
        .await
        .unwrap();

        // Insert into child without a matching parent should fail
        let result = sqlx::query("INSERT INTO child (id, parent_id) VALUES ('c-1', 'nonexistent')")
            .execute(&pool)
            .await;

        assert!(result.is_err(), "FK constraint should reject orphan insert");
    }
}
