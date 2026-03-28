use reqwest::Client;
use serde_json::Value;
use sqlx::SqlitePool;

const SYNCABLE_TABLES: &[&str] = &[
    "exercises",
    "workout_logs",
    "logged_activity_groups",
    "logged_activities",
    "logged_sets",
    "user_profiles",
    "one_rep_max_history",
];

pub async fn push_all(
    pool: &SqlitePool,
    supabase_url: &str,
    supabase_key: &str,
    access_token: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = Client::new();

    for table in SYNCABLE_TABLES {
        push_table(pool, &client, table, supabase_url, supabase_key, access_token).await?;
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
    // Get last push timestamp for this table
    let last_push_at: Option<(i64,)> =
        sqlx::query_as("SELECT last_push_at FROM sync_metadata WHERE table_name = ?")
            .bind(table)
            .fetch_optional(pool)
            .await?;
    let last_push_at = last_push_at.map(|(v,)| v).unwrap_or(0);

    // Query rows updated since last push (dynamic SQL since table name varies)
    let query = format!(
        "SELECT json_object('id', id, 'updated_at', updated_at) as json_row FROM {} WHERE updated_at > ?",
        table
    );
    let rows: Vec<(String,)> = sqlx::query_as(&query)
        .bind(last_push_at)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    let json_rows: Vec<Value> = rows
        .into_iter()
        .filter_map(|(s,)| serde_json::from_str(&s).ok())
        .collect();

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
        // Update last_push_at
        let now = chrono::Utc::now().timestamp_millis();
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
