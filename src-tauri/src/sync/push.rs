use reqwest::Client;
use serde_json::Value;
use sqlx::SqlitePool;

pub async fn push_all(
    pool: &SqlitePool,
    supabase_url: &str,
    supabase_key: &str,
    access_token: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = Client::new();

    for table in super::SYNCABLE_TABLES {
        push_table(
            pool,
            &client,
            table,
            supabase_url,
            supabase_key,
            access_token,
        )
        .await?;
    }
    Ok(())
}

async fn push_table(
    pool: &SqlitePool,
    client: &Client,
    table: &str,
    supabase_url: &str,
    supabase_key: &str,
    access_token: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if !crate::sync::SYNCABLE_TABLES.contains(&table) {
        log::error!("[push] push_table called with non-allowlisted table: {table}");
        return Err(format!("Table '{table}' is not in SYNCABLE_TABLES allowlist").into());
    }

    let last_push_at: Option<(i64,)> =
        sqlx::query_as("SELECT last_push_at FROM sync_metadata WHERE table_name = ?")
            .bind(table)
            .fetch_optional(pool)
            .await?;
    let last_push_at = last_push_at.map(|(v,)| v).unwrap_or(0);

    // Get all column names for the table
    let columns: Vec<(String,)> =
        sqlx::query_as("SELECT name FROM pragma_table_info(?) ORDER BY cid")
            .bind(table)
            .fetch_all(pool)
            .await?;

    // Build json_object(...) expression with all columns
    let col_args: Vec<String> = columns
        .iter()
        .map(|(name,)| format!("'{}', {}", name, name))
        .collect();
    let json_expr = format!("json_object({})", col_args.join(", "));

    let query = format!(
        "SELECT {} AS json_row FROM {} WHERE updated_at > ?",
        json_expr, table
    );
    let raw_rows: Vec<(String,)> = sqlx::query_as(&query)
        .bind(last_push_at)
        .fetch_all(pool)
        .await?;

    let mut json_rows = Vec::new();
    let mut parse_errors = 0usize;
    for (s,) in raw_rows {
        match serde_json::from_str::<Value>(&s) {
            Ok(v) => json_rows.push(v),
            Err(e) => {
                log::error!("[push] Failed to deserialize row from {table}: {e}");
                parse_errors += 1;
            }
        }
    }
    if parse_errors > 0 {
        log::warn!(
            "[push] Skipping last_push_at update for {table} due to {parse_errors} parse errors"
        );
        return Ok(());
    }

    if json_rows.is_empty() {
        return Ok(());
    }

    // Batch upsert to Supabase
    let url = format!("{}/rest/v1/{}", supabase_url, table);
    let response = client
        .post(&url)
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Prefer", "resolution=merge-duplicates")
        .header("Content-Type", "application/json")
        .json(&json_rows)
        .send()
        .await?;

    if response.status().is_success() {
        let now = chrono::Utc::now().timestamp();
        sqlx::query("UPDATE sync_metadata SET last_push_at = ? WHERE table_name = ?")
            .bind(now)
            .bind(table)
            .execute(pool)
            .await?;
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Push to {table} failed: HTTP {status} - {body}").into());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn push_table_rejects_non_allowlisted_table() {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("pool");

        // Create the sync_metadata table so setup is valid
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS sync_metadata (
                table_name TEXT PRIMARY KEY,
                last_push_at INTEGER NOT NULL DEFAULT 0,
                last_pull_at INTEGER NOT NULL DEFAULT 0
            )",
        )
        .execute(&pool)
        .await
        .expect("create sync_metadata");

        let client = Client::new();

        // "nonexistent_table" is not in SYNCABLE_TABLES, so the allowlist
        // guard should reject it with an error.
        let result = push_table(
            &pool,
            &client,
            "nonexistent_table",
            "http://example.com",
            "key",
            "token",
        )
        .await;

        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(
            msg.contains("not in SYNCABLE_TABLES allowlist"),
            "Expected allowlist error, got: {msg}"
        );
    }

    #[tokio::test]
    async fn push_table_returns_ok_for_empty_allowlisted_table() {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("pool");

        // Create sync_metadata and the exercises table (a real allowlisted table)
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS sync_metadata (
                table_name TEXT PRIMARY KEY,
                last_push_at INTEGER NOT NULL DEFAULT 0,
                last_pull_at INTEGER NOT NULL DEFAULT 0
            )",
        )
        .execute(&pool)
        .await
        .expect("create sync_metadata");

        sqlx::query(
            "CREATE TABLE exercises (
                id TEXT PRIMARY KEY,
                name TEXT,
                is_custom INTEGER,
                updated_at INTEGER,
                aliases TEXT
            )",
        )
        .execute(&pool)
        .await
        .expect("create exercises table");

        let client = Client::new();

        // "exercises" is in SYNCABLE_TABLES and the table exists but is empty,
        // so push_table should return Ok (no rows to push).
        let result = push_table(
            &pool,
            &client,
            "exercises",
            "http://example.com",
            "key",
            "token",
        )
        .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn push_table_skips_rows_before_last_push_at() {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("pool");

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS sync_metadata (
                table_name TEXT PRIMARY KEY,
                last_push_at INTEGER NOT NULL DEFAULT 0,
                last_pull_at INTEGER NOT NULL DEFAULT 0
            )",
        )
        .execute(&pool)
        .await
        .expect("create sync_metadata");

        sqlx::query(
            "CREATE TABLE exercises (
                id TEXT PRIMARY KEY,
                name TEXT,
                is_custom INTEGER,
                updated_at INTEGER,
                aliases TEXT
            )",
        )
        .execute(&pool)
        .await
        .expect("create exercises table");

        // Set last_push_at to a high timestamp so all rows are "already pushed"
        sqlx::query(
            "INSERT INTO sync_metadata (table_name, last_push_at) VALUES ('exercises', 9999999999)",
        )
        .execute(&pool)
        .await
        .expect("seed sync_metadata");

        // Insert a row with updated_at older than last_push_at
        sqlx::query(
            "INSERT INTO exercises (id, name, is_custom, updated_at) VALUES ('ex-1', 'Squat', 0, 1000)",
        )
        .execute(&pool)
        .await
        .expect("seed exercise");

        let client = Client::new();

        // Should return Ok because no rows match updated_at > last_push_at
        let result = push_table(
            &pool,
            &client,
            "exercises",
            "http://example.com",
            "key",
            "token",
        )
        .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn push_table_builds_json_from_all_columns() {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("pool");

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS sync_metadata (
                table_name TEXT PRIMARY KEY,
                last_push_at INTEGER NOT NULL DEFAULT 0,
                last_pull_at INTEGER NOT NULL DEFAULT 0
            )",
        )
        .execute(&pool)
        .await
        .expect("create sync_metadata");

        sqlx::query(
            "CREATE TABLE exercises (
                id TEXT PRIMARY KEY,
                name TEXT,
                is_custom INTEGER,
                updated_at INTEGER,
                aliases TEXT
            )",
        )
        .execute(&pool)
        .await
        .expect("create exercises table");

        sqlx::query(
            "INSERT INTO exercises (id, name, is_custom, updated_at, aliases) \
             VALUES ('ex-1', 'Deadlift', 1, 1000, 'DL')",
        )
        .execute(&pool)
        .await
        .expect("seed exercise");

        // Verify the json_object query works correctly by running the same
        // pattern that push_table uses internally.
        let columns: Vec<(String,)> =
            sqlx::query_as("SELECT name FROM pragma_table_info('exercises') ORDER BY cid")
                .fetch_all(&pool)
                .await
                .expect("pragma");

        let col_args: Vec<String> = columns
            .iter()
            .map(|(name,)| format!("'{}', {}", name, name))
            .collect();
        let json_expr = format!("json_object({})", col_args.join(", "));
        let query = format!(
            "SELECT {} AS json_row FROM exercises WHERE updated_at > 0",
            json_expr
        );
        let raw_rows: Vec<(String,)> = sqlx::query_as(&query)
            .fetch_all(&pool)
            .await
            .expect("query");

        assert_eq!(raw_rows.len(), 1);
        let parsed: Value = serde_json::from_str(&raw_rows[0].0).expect("parse json");
        assert_eq!(parsed["id"], "ex-1");
        assert_eq!(parsed["name"], "Deadlift");
        assert_eq!(parsed["is_custom"], 1);
        assert_eq!(parsed["aliases"], "DL");
    }

    #[tokio::test]
    async fn push_all_rejects_if_any_table_missing() {
        // push_all iterates SYNCABLE_TABLES; if one table doesn't exist in
        // the DB schema the underlying query will fail. Verify push_all
        // surfaces the error rather than silently continuing.
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("pool");

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS sync_metadata (
                table_name TEXT PRIMARY KEY,
                last_push_at INTEGER NOT NULL DEFAULT 0,
                last_pull_at INTEGER NOT NULL DEFAULT 0
            )",
        )
        .execute(&pool)
        .await
        .expect("create sync_metadata");

        // Do NOT create any of the syncable tables -- push_all should error
        let result = push_all(&pool, "http://example.com", "key", "token").await;
        assert!(result.is_err());
    }
}
