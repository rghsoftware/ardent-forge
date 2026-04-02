use futures_util::{SinkExt, StreamExt};
use reqwest::Client;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use url::Url;

/// Parse a remote timestamp value into epoch seconds.
///
/// Handles multiple formats from Supabase:
/// - Already numeric (i64) -- returned as-is
/// - ISO 8601 string with timezone (e.g. "2026-03-27T14:30:00+00:00")
/// - ISO 8601 string without timezone (e.g. "2026-03-27T14:30:00.000")
/// - Falls back to 0 (safe default: local wins on conflict)
fn parse_remote_timestamp(val: Option<&Value>) -> i64 {
    let val = match val {
        Some(v) => v,
        None => return 0,
    };

    // Try numeric first (e.g. from REST API)
    if let Some(n) = val.as_i64() {
        return n;
    }

    // Try string-based ISO 8601 parsing
    if let Some(s) = val.as_str() {
        // RFC 3339 / ISO 8601 with timezone offset
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
            return dt.timestamp();
        }
        // Supabase format without timezone (assume UTC)
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f") {
            return dt.and_utc().timestamp();
        }
        // Try without fractional seconds
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S") {
            return dt.and_utc().timestamp();
        }
    }

    0
}

/// Coerce a JSON value from Supabase into the type expected by SQLite.
///
/// SQLite stores timestamps as INTEGER (epoch seconds), booleans as INTEGER
/// (0/1), and JSON blobs as TEXT. This function performs the necessary
/// conversion based on the declared column type from `pragma_table_info`.
fn coerce_value(sqlite_type: &str, json_val: &Value) -> Value {
    match sqlite_type.to_uppercase().as_str() {
        "INTEGER" => match json_val {
            Value::Bool(b) => json!(if *b { 1 } else { 0 }),
            Value::String(s) => {
                // Try ISO 8601 -> epoch seconds
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
                    json!(dt.timestamp())
                } else if let Ok(dt) =
                    chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f")
                {
                    json!(dt.and_utc().timestamp())
                } else if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
                {
                    json!(dt.and_utc().timestamp())
                } else {
                    // Not a timestamp string -- pass through (may be a
                    // numeric string like "42")
                    if let Ok(n) = s.parse::<i64>() {
                        json!(n)
                    } else {
                        json_val.clone()
                    }
                }
            }
            Value::Number(_) | Value::Null => json_val.clone(),
            // Objects/arrays should not be INTEGER, pass through
            _ => json_val.clone(),
        },
        "TEXT" => match json_val {
            Value::Object(_) | Value::Array(_) => {
                // Serialize nested JSON to a string for SQLite TEXT storage
                json!(json_val.to_string())
            }
            Value::String(_) | Value::Null => json_val.clone(),
            // Booleans/numbers as text -- convert to string representation
            Value::Bool(b) => json!(b.to_string()),
            Value::Number(n) => json!(n.to_string()),
        },
        "REAL" => json_val.clone(),
        _ => json_val.clone(),
    }
}

const PAGE_SIZE: usize = 1000;

/// Pull all rows from a single Supabase table into local SQLite.
///
/// Paginates via the `Range` header in chunks of 1000 rows, upserting each
/// row locally. Updates `sync_metadata.last_pull_at` on completion.
pub async fn pull_table(
    pool: &SqlitePool,
    client: &Client,
    table: &str,
    supabase_url: &str,
    supabase_key: &str,
    access_token: &str,
    app_handle: &AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let _ = app_handle.emit(
        "sync:pull_progress",
        json!({"table": table, "status": "pulling"}),
    );

    let mut offset: usize = 0;
    loop {
        let url = format!("{}/rest/v1/{}?select=*&order=id", supabase_url, table);

        let range_end = offset + PAGE_SIZE - 1;
        let response = client
            .get(&url)
            .header("apikey", supabase_key)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Range", format!("{}-{}", offset, range_end))
            .header("Prefer", "count=exact")
            .send()
            .await?;

        let rows: Vec<Value> = response.json().await?;
        let row_count = rows.len();

        for row in &rows {
            upsert_row(pool, table, row).await?;
        }

        if row_count < PAGE_SIZE {
            break;
        }
        offset += PAGE_SIZE;
    }

    // Update sync_metadata with the pull timestamp (epoch seconds)
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "INSERT INTO sync_metadata (table_name, last_pull_at, last_push_at) VALUES (?, ?, 0)
         ON CONFLICT(table_name) DO UPDATE SET last_pull_at = ?",
    )
    .bind(table)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;

    let _ = app_handle.emit(
        "sync:pull_progress",
        json!({"table": table, "status": "done"}),
    );

    Ok(())
}

/// Pull all syncable tables from Supabase into local SQLite.
///
/// Iterates over `SYNCABLE_TABLES`, pulling each one sequentially. Emits a
/// `sync:data_changed` event after each table succeeds so the frontend can
/// progressively invalidate caches. Fails fast on any error.
pub async fn pull_all(
    pool: &SqlitePool,
    supabase_url: &str,
    supabase_key: &str,
    access_token: &str,
    app_handle: &AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = Client::new();

    for table in super::SYNCABLE_TABLES {
        pull_table(
            pool,
            &client,
            table,
            supabase_url,
            supabase_key,
            access_token,
            app_handle,
        )
        .await?;

        let _ = app_handle.emit("sync:data_changed", json!({"table": table}));
    }

    Ok(())
}

pub async fn start_realtime_subscription(
    pool: SqlitePool,
    supabase_url: &str,
    supabase_key: &str,
    access_token: &str,
    app_handle: AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Convert https://xxx.supabase.co to wss://xxx.supabase.co
    let ws_url = supabase_url
        .replace("https://", "wss://")
        .replace("http://", "ws://");

    let ws_endpoint = format!(
        "{}/realtime/v1/websocket?apikey={}&vsn=1.0.0",
        ws_url, supabase_key
    );

    let url = Url::parse(&ws_endpoint)?;
    let (mut ws_stream, _) = connect_async(url.to_string()).await?;

    // Phoenix channel join for postgres_changes
    let join_msg = json!({
        "topic": "realtime:public",
        "event": "phx_join",
        "payload": {
            "config": {
                "broadcast": {"self": false},
                "presence": {"key": ""},
                "postgres_changes": [
                    {"event": "*", "schema": "public"}
                ]
            },
            "access_token": access_token
        },
        "ref": "1"
    });
    ws_stream
        .send(Message::Text(join_msg.to_string().into()))
        .await?;

    // Listen for messages
    while let Some(msg) = ws_stream.next().await {
        match msg {
            Ok(Message::Text(text)) => match serde_json::from_str::<Value>(&text) {
                Ok(payload) => {
                    handle_realtime_message(&pool, &payload, &app_handle).await;
                }
                Err(e) => {
                    log::debug!("[pull] Failed to parse WebSocket JSON: {e}");
                }
            },
            Ok(Message::Ping(data)) => {
                let _ = ws_stream.send(Message::Pong(data)).await;
            }
            Err(e) => {
                eprintln!("Realtime WebSocket error: {e}");
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

async fn handle_realtime_message(pool: &SqlitePool, payload: &Value, app_handle: &AppHandle) {
    let event = payload.get("event").and_then(|e| e.as_str()).unwrap_or("");

    if event != "postgres_changes" {
        return;
    }

    let data = match payload.get("payload").and_then(|p| p.get("data")) {
        Some(d) => d,
        None => return,
    };

    let table = data.get("table").and_then(|t| t.as_str()).unwrap_or("");
    let schema = data.get("schema").and_then(|s| s.as_str()).unwrap_or("");
    let change_type = data.get("type").and_then(|t| t.as_str()).unwrap_or("");

    if schema != "public" {
        return;
    }

    if !crate::sync::SYNCABLE_TABLES.contains(&table) {
        log::warn!("[pull] Ignoring message for non-allowlisted table: {table}");
        return;
    }

    match change_type {
        "INSERT" | "UPDATE" => {
            if let Some(record) = data.get("record") {
                let row_id = record.get("id").and_then(|id| id.as_str()).unwrap_or("");
                match upsert_row(pool, table, record).await {
                    Ok(()) => {
                        if let Err(e) = app_handle.emit(
                            "sync:data_changed",
                            json!({
                                "table": table,
                                "id": row_id
                            }),
                        ) {
                            log::error!("[pull] Failed to emit data_changed: {e}");
                        }
                    }
                    Err(e) => {
                        log::error!("[pull] upsert_row failed for {table}/{row_id}: {e}");
                    }
                }
            }
        }
        "DELETE" => {
            if let Some(old_record) = data.get("old_record") {
                let row_id = old_record
                    .get("id")
                    .and_then(|id| id.as_str())
                    .unwrap_or("");
                if !row_id.is_empty() {
                    match delete_row(pool, table, row_id).await {
                        Ok(()) => {
                            if let Err(e) = app_handle.emit(
                                "sync:data_changed",
                                json!({
                                    "table": table,
                                    "id": row_id
                                }),
                            ) {
                                log::error!("[pull] Failed to emit data_changed: {e}");
                            }
                        }
                        Err(e) => {
                            log::error!("[pull] delete_row failed for {table}/{row_id}: {e}");
                        }
                    }
                }
            }
        }
        other => {
            log::debug!("[pull] Unrecognized change type: {other}");
        }
    }
}

async fn upsert_row(pool: &SqlitePool, table: &str, record: &Value) -> Result<(), sqlx::Error> {
    #[cfg(not(test))]
    if !crate::sync::SYNCABLE_TABLES.contains(&table) {
        log::error!("[pull] upsert_row called with non-allowlisted table: {table}");
        return Err(sqlx::Error::Protocol(format!(
            "Table '{table}' is not in SYNCABLE_TABLES allowlist"
        )));
    }

    use crate::sync::conflict::resolve_conflict;
    use crate::sync::conflict::Winner;

    let row_id = record.get("id").and_then(|id| id.as_str()).unwrap_or("");
    if row_id.is_empty() {
        return Ok(());
    }

    // Check local updated_at for LWW conflict resolution
    let local_updated_at: Option<(i64,)> =
        sqlx::query_as(&format!("SELECT updated_at FROM {} WHERE id = ?", table))
            .bind(row_id)
            .fetch_optional(pool)
            .await?;

    let remote_updated_at = parse_remote_timestamp(record.get("updated_at"));

    if let Some((local_ts,)) = local_updated_at {
        if resolve_conflict(local_ts, remote_updated_at) == Winner::Local {
            // Local is newer, skip remote update
            return Ok(());
        }
    }

    // Discover table columns and their declared types via pragma
    let columns: Vec<(String, String)> =
        sqlx::query_as("SELECT name, type FROM pragma_table_info(?)")
            .bind(table)
            .fetch_all(pool)
            .await?;

    if columns.is_empty() {
        log::warn!("[pull] upsert_row: table {table} has no columns (missing table?)");
        return Ok(());
    }

    // Filter to columns present in the remote JSON record
    let matched: Vec<(&str, &str, Value)> = columns
        .iter()
        .filter_map(|(col_name, col_type)| {
            record.get(col_name.as_str()).map(|json_val| {
                let coerced = coerce_value(col_type, json_val);
                (col_name.as_str(), col_type.as_str(), coerced)
            })
        })
        .collect();

    if matched.is_empty() {
        log::warn!("[pull] upsert_row: no matching columns for {table}/{row_id}");
        return Ok(());
    }

    // Build dynamic INSERT ... ON CONFLICT(id) DO UPDATE SET ...
    let col_names: Vec<&str> = matched.iter().map(|(name, _, _)| *name).collect();
    let placeholders: Vec<String> = (1..=col_names.len()).map(|i| format!("?{i}")).collect();
    let update_set: Vec<String> = col_names
        .iter()
        .filter(|name| **name != "id")
        .map(|name| format!("{name}=excluded.{name}"))
        .collect();

    let sql = format!(
        "INSERT INTO {table} ({cols}) VALUES ({vals}) ON CONFLICT(id) DO UPDATE SET {sets}",
        cols = col_names.join(", "),
        vals = placeholders.join(", "),
        sets = update_set.join(", "),
    );

    // Bind each coerced value
    let mut query = sqlx::query(&sql);
    for (_, _, ref coerced) in &matched {
        query = match coerced {
            Value::Null => query.bind(None::<String>),
            Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    query.bind(i)
                } else if let Some(f) = n.as_f64() {
                    query.bind(f)
                } else {
                    query.bind(n.to_string())
                }
            }
            Value::String(s) => query.bind(s.clone()),
            Value::Bool(b) => query.bind(if *b { 1i64 } else { 0i64 }),
            // Objects/arrays should already be serialized by coerce_value,
            // but handle gracefully just in case
            _ => query.bind(coerced.to_string()),
        };
    }

    query.execute(pool).await?;
    log::info!("[pull] upsert_row: wrote remote record for {table}/{row_id}");
    Ok(())
}

async fn delete_row(pool: &SqlitePool, table: &str, row_id: &str) -> Result<(), sqlx::Error> {
    #[cfg(not(test))]
    if !crate::sync::SYNCABLE_TABLES.contains(&table) {
        log::error!("[pull] delete_row called with non-allowlisted table: {table}");
        return Err(sqlx::Error::Protocol(format!(
            "Table '{table}' is not in SYNCABLE_TABLES allowlist"
        )));
    }

    sqlx::query(&format!("DELETE FROM {} WHERE id = ?", table))
        .bind(row_id)
        .execute(pool)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use sqlx::sqlite::SqlitePoolOptions;
    use sqlx::Row;

    // ================================================================
    // S001-T: parse_remote_timestamp tests
    // ================================================================

    #[test]
    fn parse_timestamp_iso8601_with_timezone() {
        let val = json!("2026-03-27T14:30:00+00:00");
        let ts = parse_remote_timestamp(Some(&val));
        // 2026-03-27T14:30:00Z in epoch seconds
        let expected = chrono::DateTime::parse_from_rfc3339("2026-03-27T14:30:00+00:00")
            .unwrap()
            .timestamp();
        assert_eq!(ts, expected);
        assert_eq!(ts, 1774621800); // verify exact value
    }

    #[test]
    fn parse_timestamp_i64_value() {
        let val = json!(1774621800_i64);
        let ts = parse_remote_timestamp(Some(&val));
        assert_eq!(ts, 1774621800);
    }

    #[test]
    fn parse_timestamp_null() {
        let val = json!(null);
        let ts = parse_remote_timestamp(Some(&val));
        assert_eq!(ts, 0);
    }

    #[test]
    fn parse_timestamp_none() {
        let ts = parse_remote_timestamp(None);
        assert_eq!(ts, 0);
    }

    #[test]
    fn parse_timestamp_garbage_string() {
        let val = json!("not-a-timestamp");
        let ts = parse_remote_timestamp(Some(&val));
        assert_eq!(ts, 0);
    }

    #[test]
    fn parse_timestamp_iso_without_timezone() {
        let val = json!("2026-03-27T14:30:00.000");
        let ts = parse_remote_timestamp(Some(&val));
        let expected = chrono::NaiveDateTime::parse_from_str(
            "2026-03-27T14:30:00.000",
            "%Y-%m-%dT%H:%M:%S%.f",
        )
        .unwrap()
        .and_utc()
        .timestamp();
        assert_eq!(ts, expected);
    }

    #[test]
    fn parse_timestamp_iso_without_fractional() {
        let val = json!("2026-03-27T14:30:00");
        let ts = parse_remote_timestamp(Some(&val));
        assert!(ts > 0);
    }

    // ================================================================
    // S001-T: coerce_value tests
    // ================================================================

    #[test]
    fn coerce_bool_true_to_integer() {
        assert_eq!(coerce_value("INTEGER", &json!(true)), json!(1));
    }

    #[test]
    fn coerce_bool_false_to_integer() {
        assert_eq!(coerce_value("INTEGER", &json!(false)), json!(0));
    }

    #[test]
    fn coerce_iso_string_to_integer_epoch() {
        let result = coerce_value("INTEGER", &json!("2026-03-27T14:30:00+00:00"));
        let expected = chrono::DateTime::parse_from_rfc3339("2026-03-27T14:30:00+00:00")
            .unwrap()
            .timestamp();
        assert_eq!(result, json!(expected));
    }

    #[test]
    fn coerce_json_object_to_text() {
        let obj = json!({"a": 1});
        let result = coerce_value("TEXT", &obj);
        // Should be a JSON string containing the serialized object
        assert_eq!(result, json!("{\"a\":1}"));
    }

    #[test]
    fn coerce_json_array_to_text() {
        let arr = json!([1, 2, 3]);
        let result = coerce_value("TEXT", &arr);
        assert_eq!(result, json!("[1,2,3]"));
    }

    #[test]
    fn coerce_string_to_text_passthrough() {
        assert_eq!(coerce_value("TEXT", &json!("hello")), json!("hello"));
    }

    #[test]
    fn coerce_null_integer_passthrough() {
        assert_eq!(coerce_value("INTEGER", &json!(null)), json!(null));
    }

    #[test]
    fn coerce_null_text_passthrough() {
        assert_eq!(coerce_value("TEXT", &json!(null)), json!(null));
    }

    #[test]
    fn coerce_number_integer_passthrough() {
        assert_eq!(coerce_value("INTEGER", &json!(42)), json!(42));
    }

    #[test]
    fn coerce_real_passthrough() {
        assert_eq!(coerce_value("REAL", &json!(3.14)), json!(3.14));
    }

    #[test]
    fn coerce_numeric_string_to_integer() {
        assert_eq!(coerce_value("INTEGER", &json!("42")), json!(42));
    }

    #[test]
    fn coerce_bool_to_text() {
        assert_eq!(coerce_value("TEXT", &json!(true)), json!("true"));
    }

    // ================================================================
    // S002-T: upsert_row integration tests (in-memory SQLite)
    // ================================================================

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("connect in-memory db");

        sqlx::query(
            "CREATE TABLE test_table (
                id TEXT PRIMARY KEY,
                name TEXT,
                is_custom INTEGER,
                updated_at INTEGER,
                aliases TEXT
            )",
        )
        .execute(&pool)
        .await
        .expect("create test_table");

        pool
    }

    #[tokio::test]
    async fn upsert_inserts_new_row() {
        let pool = setup_test_db().await;

        let record = json!({
            "id": "row-1",
            "name": "Bench Press",
            "is_custom": false,
            "updated_at": "2026-03-27T14:30:00+00:00",
            "aliases": ["bench", "bp"]
        });

        upsert_row(&pool, "test_table", &record).await.unwrap();

        let row = sqlx::query(
            "SELECT id, name, is_custom, updated_at, aliases FROM test_table WHERE id = ?",
        )
        .bind("row-1")
        .fetch_one(&pool)
        .await
        .unwrap();

        let id: String = row.get("id");
        let name: String = row.get("name");
        let is_custom: i64 = row.get("is_custom");
        let updated_at: i64 = row.get("updated_at");
        let aliases: String = row.get("aliases");

        assert_eq!(id, "row-1");
        assert_eq!(name, "Bench Press");
        assert_eq!(is_custom, 0); // false -> 0
        let expected_ts = chrono::DateTime::parse_from_rfc3339("2026-03-27T14:30:00+00:00")
            .unwrap()
            .timestamp();
        assert_eq!(updated_at, expected_ts);
        assert_eq!(aliases, "[\"bench\",\"bp\"]"); // array -> serialized text
    }

    #[tokio::test]
    async fn upsert_updates_when_remote_newer() {
        let pool = setup_test_db().await;

        // Seed a local row with old timestamp
        sqlx::query(
            "INSERT INTO test_table (id, name, is_custom, updated_at, aliases)
             VALUES ('row-2', 'Old Name', 0, 100, NULL)",
        )
        .execute(&pool)
        .await
        .unwrap();

        // Remote record with a newer timestamp
        let record = json!({
            "id": "row-2",
            "name": "Updated Name",
            "is_custom": true,
            "updated_at": "2026-03-27T14:30:00+00:00",
            "aliases": null
        });

        upsert_row(&pool, "test_table", &record).await.unwrap();

        let row = sqlx::query("SELECT name, is_custom, updated_at FROM test_table WHERE id = ?")
            .bind("row-2")
            .fetch_one(&pool)
            .await
            .unwrap();

        let name: String = row.get("name");
        let is_custom: i64 = row.get("is_custom");
        let updated_at: i64 = row.get("updated_at");

        assert_eq!(name, "Updated Name");
        assert_eq!(is_custom, 1); // true -> 1
        assert!(updated_at > 100);
    }

    #[tokio::test]
    async fn upsert_skips_when_local_newer() {
        let pool = setup_test_db().await;

        // Seed a local row with a very large timestamp (far future)
        sqlx::query(
            "INSERT INTO test_table (id, name, is_custom, updated_at, aliases)
             VALUES ('row-3', 'Local Name', 1, 9999999999, NULL)",
        )
        .execute(&pool)
        .await
        .unwrap();

        // Remote record with an older timestamp
        let record = json!({
            "id": "row-3",
            "name": "Remote Name",
            "is_custom": false,
            "updated_at": "2026-03-27T14:30:00+00:00",
            "aliases": null
        });

        upsert_row(&pool, "test_table", &record).await.unwrap();

        // Verify local data is unchanged
        let row = sqlx::query("SELECT name, is_custom FROM test_table WHERE id = ?")
            .bind("row-3")
            .fetch_one(&pool)
            .await
            .unwrap();

        let name: String = row.get("name");
        let is_custom: i64 = row.get("is_custom");

        assert_eq!(name, "Local Name");
        assert_eq!(is_custom, 1);
    }

    #[tokio::test]
    async fn upsert_handles_null_optional_columns() {
        let pool = setup_test_db().await;

        let record = json!({
            "id": "row-4",
            "name": "Squat",
            "is_custom": null,
            "updated_at": 500,
            "aliases": null
        });

        upsert_row(&pool, "test_table", &record).await.unwrap();

        let row = sqlx::query("SELECT id, name, is_custom, aliases FROM test_table WHERE id = ?")
            .bind("row-4")
            .fetch_one(&pool)
            .await
            .unwrap();

        let name: String = row.get("name");
        let is_custom: Option<i64> = row.get("is_custom");
        let aliases: Option<String> = row.get("aliases");

        assert_eq!(name, "Squat");
        assert!(is_custom.is_none());
        assert!(aliases.is_none());
    }

    #[tokio::test]
    async fn upsert_ignores_extra_json_fields() {
        let pool = setup_test_db().await;

        // Record has fields not in the table schema
        let record = json!({
            "id": "row-5",
            "name": "Deadlift",
            "is_custom": false,
            "updated_at": 1000,
            "aliases": null,
            "nonexistent_column": "should be ignored"
        });

        upsert_row(&pool, "test_table", &record).await.unwrap();

        let row = sqlx::query("SELECT name FROM test_table WHERE id = ?")
            .bind("row-5")
            .fetch_one(&pool)
            .await
            .unwrap();

        let name: String = row.get("name");
        assert_eq!(name, "Deadlift");
    }

    #[tokio::test]
    async fn upsert_empty_id_is_noop() {
        let pool = setup_test_db().await;

        let record = json!({
            "id": "",
            "name": "Ghost",
            "updated_at": 1000
        });

        upsert_row(&pool, "test_table", &record).await.unwrap();

        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM test_table")
            .fetch_one(&pool)
            .await
            .unwrap();

        assert_eq!(count.0, 0);
    }
}
