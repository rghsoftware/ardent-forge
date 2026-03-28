use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;
use tauri::Manager;

/// Initialize the SQLite database in the Tauri app data directory.
///
/// - Creates the app data directory if it does not exist.
/// - Opens (or creates) `ardent_forge.db` with foreign keys enabled.
/// - Runs all pending migrations from `./migrations`.
/// - Returns a connection pool ready for use.
pub async fn init_db(app: &tauri::App) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;

    // Ensure the directory exists
    std::fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("ardent_forge.db");
    let db_url = format!("sqlite:{}", db_path.display());

    let options = SqliteConnectOptions::from_str(&db_url)?
        .create_if_missing(true)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    log::info!("Database initialized at {}", db_path.display());

    Ok(pool)
}
