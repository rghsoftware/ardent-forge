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
