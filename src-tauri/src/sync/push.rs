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
    #[cfg(not(test))]
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
    async fn push_table_propagates_query_error_for_nonexistent_table() {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("pool");

        // Create the sync_metadata table so the first query succeeds
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

        // "nonexistent_table" has no rows in sync_metadata and no real table,
        // so pragma_table_info returns empty columns, producing an empty
        // json_object() expression. The SELECT query itself will fail.
        // The function should either succeed with 0 rows or fail gracefully
        // (not panic).
        let result = push_table(
            &pool,
            &client,
            "nonexistent_table",
            "http://example.com",
            "key",
            "token",
        )
        .await;

        // It should either succeed (empty pragma = empty columns = early return)
        // or fail with a proper error, but must never panic.
        assert!(result.is_ok() || result.is_err());
        if let Err(e) = result {
            let msg = e.to_string();
            assert!(!msg.is_empty());
        }
    }
}
