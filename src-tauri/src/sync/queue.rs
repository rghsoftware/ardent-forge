use serde_json::Value;
use sqlx::SqlitePool;
use uuid::Uuid;

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

pub async fn mark_failed(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    // Increment attempts
    sqlx::query("UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    // Dead-letter items with >= 5 attempts
    let attempts: Option<(i64,)> =
        sqlx::query_as("SELECT attempts FROM sync_queue WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;

    if let Some((attempts,)) = attempts {
        if attempts >= 5 {
            eprintln!("Dead-lettering sync queue item {id} after {attempts} failed attempts");
            sqlx::query("DELETE FROM sync_queue WHERE id = ?")
                .bind(id)
                .execute(pool)
                .await?;
        }
    }
    Ok(())
}

pub async fn flush(
    pool: &SqlitePool,
    supabase_url: &str,
    supabase_key: &str,
    access_token: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::new();
    let items = dequeue_batch(pool, 100).await?;

    for item in items {
        let url = format!("{}/rest/v1/{}", supabase_url, item.table_name);
        let result = if item.operation == "DELETE" {
            client
                .delete(format!("{}?id=eq.{}", url, item.row_id))
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
            mark_failed(pool, &item.id).await?;
            continue;
        };

        match result {
            Ok(resp) if resp.status().is_success() => {
                mark_complete(pool, &item.id).await?;
            }
            Ok(resp) => {
                eprintln!(
                    "Sync queue flush failed for {}: HTTP {}",
                    item.id,
                    resp.status()
                );
                mark_failed(pool, &item.id).await?;
            }
            Err(e) => {
                eprintln!("Sync queue flush error for {}: {e}", item.id);
                mark_failed(pool, &item.id).await?;
            }
        }
    }
    Ok(())
}
