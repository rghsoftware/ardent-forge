use serde_json::Value;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};
use url::Url;
use uuid::Uuid;

const MAX_RETRY_ATTEMPTS: i64 = 5;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum SyncOperation {
    Insert,
    Update,
    Delete,
}

pub enum DeadLetterResult {
    Retrying,
    DeadLettered { table_name: String, row_id: String },
}

#[derive(sqlx::FromRow)]
#[allow(dead_code)]
pub struct QueuedItem {
    pub id: String,
    pub table_name: String,
    pub row_id: String,
    pub operation: String,
    pub payload: Option<String>,
    pub attempts: i64,
}

pub async fn enqueue(
    pool: &SqlitePool,
    table_name: &str,
    row_id: &str,
    operation: &str,
    payload: Option<&Value>,
) -> Result<(), sqlx::Error> {
    let id = Uuid::new_v4().to_string();
    let payload_str = payload.map(|p| p.to_string());
    let now = chrono::Utc::now().timestamp_millis();

    sqlx::query(
        "INSERT INTO sync_queue (id, table_name, row_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(table_name)
    .bind(row_id)
    .bind(operation)
    .bind(&payload_str)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn dequeue_batch(pool: &SqlitePool, limit: i64) -> Result<Vec<QueuedItem>, sqlx::Error> {
    let rows: Vec<QueuedItem> = sqlx::query_as(
        "SELECT id, table_name, row_id, operation, payload, attempts FROM sync_queue ORDER BY created_at ASC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn mark_complete(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM sync_queue WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_failed(pool: &SqlitePool, id: &str) -> Result<DeadLetterResult, sqlx::Error> {
    sqlx::query("UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    // Fetch table_name and row_id before potentially deleting
    let row: Option<(String, String, i64)> = sqlx::query_as(
        "SELECT table_name, row_id, attempts FROM sync_queue WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    if let Some((table_name, row_id, attempts)) = row {
        if attempts >= MAX_RETRY_ATTEMPTS {
            sqlx::query("DELETE FROM sync_queue WHERE id = ?")
                .bind(id)
                .execute(pool)
                .await?;
            return Ok(DeadLetterResult::DeadLettered { table_name, row_id });
        }
    }

    Ok(DeadLetterResult::Retrying)
}

pub async fn flush(
    pool: &SqlitePool,
    supabase_url: &str,
    supabase_key: &str,
    access_token: &str,
    app_handle: &AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::new();
    let items = dequeue_batch(pool, 100).await?;

    for item in items {
        let url = format!("{}/rest/v1/{}", supabase_url, item.table_name);
        let result = if item.operation == "DELETE" {
            let mut delete_url = Url::parse(&url)?;
            delete_url.query_pairs_mut().append_pair("id", &format!("eq.{}", item.row_id));
            client
                .delete(delete_url.as_str())
                .header("apikey", supabase_key)
                .header("Authorization", format!("Bearer {}", access_token))
                .send()
                .await
        } else if let Some(payload_str) = &item.payload {
            let payload: Value = serde_json::from_str(payload_str)?;
            client
                .post(&url)
                .header("apikey", supabase_key)
                .header("Authorization", format!("Bearer {}", access_token))
                .header("Prefer", "resolution=merge-duplicates")
                .json(&payload)
                .send()
                .await
        } else {
            handle_mark_failed(pool, &item.id, app_handle).await;
            continue;
        };

        match result {
            Ok(resp) if resp.status().is_success() => {
                mark_complete(pool, &item.id).await?;
            }
            Ok(resp) => {
                log::error!(
                    "[queue] Flush failed for {}: HTTP {}",
                    item.id,
                    resp.status()
                );
                handle_mark_failed(pool, &item.id, app_handle).await;
            }
            Err(e) => {
                log::error!("[queue] Flush error for {}: {e}", item.id);
                handle_mark_failed(pool, &item.id, app_handle).await;
            }
        }
    }
    Ok(())
}

async fn handle_mark_failed(pool: &SqlitePool, id: &str, app_handle: &AppHandle) {
    match mark_failed(pool, id).await {
        Ok(DeadLetterResult::DeadLettered { table_name, row_id }) => {
            log::error!("[queue] Item dead-lettered: {table_name}/{row_id}");
            if let Err(e) = app_handle.emit(
                "sync:dead_letter",
                serde_json::json!({
                    "table": table_name,
                    "rowId": row_id,
                }),
            ) {
                log::error!("[queue] Failed to emit dead_letter event: {e}");
            }
        }
        Ok(DeadLetterResult::Retrying) => {}
        Err(e) => {
            log::error!("[queue] mark_failed failed: {e}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("in-memory SQLite pool");
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS sync_queue (
                id TEXT PRIMARY KEY,
                table_name TEXT NOT NULL,
                row_id TEXT NOT NULL,
                operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
                payload TEXT,
                created_at INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            )
            "#,
        )
        .execute(&pool)
        .await
        .expect("create sync_queue table");
        pool
    }

    #[tokio::test]
    async fn enqueue_dequeue_round_trip() {
        let pool = setup_pool().await;
        let payload = serde_json::json!({"id": "row-1"});
        enqueue(&pool, "workout_logs", "row-1", "INSERT", Some(&payload))
            .await
            .expect("enqueue");
        let items = dequeue_batch(&pool, 10).await.expect("dequeue");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].table_name, "workout_logs");
        assert_eq!(items[0].row_id, "row-1");
    }

    #[tokio::test]
    async fn dequeue_returns_fifo_order() {
        let pool = setup_pool().await;
        for i in 1..=3 {
            enqueue(
                &pool,
                "workout_logs",
                &format!("row-{i}"),
                "INSERT",
                None,
            )
            .await
            .expect("enqueue");
            // Small delay to ensure distinct created_at timestamps
            tokio::time::sleep(tokio::time::Duration::from_millis(2)).await;
        }
        let items = dequeue_batch(&pool, 10).await.expect("dequeue");
        let ids: Vec<&str> = items.iter().map(|i| i.row_id.as_str()).collect();
        assert_eq!(ids, vec!["row-1", "row-2", "row-3"]);
    }

    #[tokio::test]
    async fn mark_complete_removes_item() {
        let pool = setup_pool().await;
        enqueue(&pool, "workout_logs", "row-1", "UPDATE", None)
            .await
            .expect("enqueue");
        let items = dequeue_batch(&pool, 10).await.expect("dequeue");
        mark_complete(&pool, &items[0].id)
            .await
            .expect("mark_complete");
        let remaining = dequeue_batch(&pool, 10)
            .await
            .expect("dequeue after complete");
        assert!(remaining.is_empty());
    }

    #[tokio::test]
    async fn mark_failed_increments_attempts() {
        let pool = setup_pool().await;
        enqueue(&pool, "workout_logs", "row-1", "INSERT", None)
            .await
            .expect("enqueue");
        let items = dequeue_batch(&pool, 10).await.expect("dequeue");
        let result = mark_failed(&pool, &items[0].id)
            .await
            .expect("mark_failed");
        assert!(matches!(result, DeadLetterResult::Retrying));
        let row: (i64,) = sqlx::query_as("SELECT attempts FROM sync_queue WHERE id = ?")
            .bind(&items[0].id)
            .fetch_one(&pool)
            .await
            .expect("fetch attempts");
        assert_eq!(row.0, 1);
    }

    #[tokio::test]
    async fn mark_failed_does_not_dead_letter_below_threshold() {
        let pool = setup_pool().await;
        enqueue(&pool, "workout_logs", "row-1", "INSERT", None)
            .await
            .expect("enqueue");
        let items = dequeue_batch(&pool, 10).await.expect("dequeue");
        let id = items[0].id.clone();
        // Set attempts to threshold - 2 so one more call stays below threshold
        sqlx::query("UPDATE sync_queue SET attempts = ? WHERE id = ?")
            .bind(MAX_RETRY_ATTEMPTS - 2)
            .bind(&id)
            .execute(&pool)
            .await
            .expect("set attempts");
        let result = mark_failed(&pool, &id).await.expect("mark_failed");
        assert!(matches!(result, DeadLetterResult::Retrying));
        // Item must still exist
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM sync_queue WHERE id = ?")
                .bind(&id)
                .fetch_one(&pool)
                .await
                .expect("count");
        assert_eq!(count.0, 1);
    }

    #[tokio::test]
    async fn mark_failed_dead_letters_at_threshold() {
        let pool = setup_pool().await;
        enqueue(&pool, "workout_logs", "row-1", "DELETE", None)
            .await
            .expect("enqueue");
        let items = dequeue_batch(&pool, 10).await.expect("dequeue");
        let id = items[0].id.clone();
        // Set attempts to threshold - 1 so one more call hits the threshold
        sqlx::query("UPDATE sync_queue SET attempts = ? WHERE id = ?")
            .bind(MAX_RETRY_ATTEMPTS - 1)
            .bind(&id)
            .execute(&pool)
            .await
            .expect("set attempts");
        let result = mark_failed(&pool, &id).await.expect("mark_failed");
        assert!(matches!(result, DeadLetterResult::DeadLettered { .. }));
        // Item must be deleted
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM sync_queue WHERE id = ?")
                .bind(&id)
                .fetch_one(&pool)
                .await
                .expect("count");
        assert_eq!(count.0, 0);
    }
}
