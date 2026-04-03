# 001 - Sync Pull Completion: Technical Plan

## Architecture Overview

The pull path completes the sync engine's bidirectional data flow. Two distinct operations need implementation:

1. **Realtime upsert** -- single-row writes triggered by Supabase Realtime WebSocket events (low-latency, event-driven)
2. **Force-pull** -- bulk download of all rows across all 15 syncable tables via Supabase REST API (user-triggered or first-sign-in)

Both share a core primitive: **dynamic column upsert** that converts Supabase JSON records to SQLite `INSERT ... ON CONFLICT` statements with type coercion.

## Critical Discovery: Type Mismatch Between Supabase and SQLite

Research revealed the schemas use different storage types for the same data:

| Data Type | Supabase (Realtime JSON) | SQLite | Conversion Required |
|-----------|--------------------------|--------|---------------------|
| Timestamps | ISO 8601 string (`"2026-03-27T14:30:00+00:00"`) | INTEGER (epoch seconds) | Parse ISO 8601 to epoch seconds |
| Booleans | JSON `true`/`false` | INTEGER (0/1) | `true` -> 1, `false` -> 0 |
| JSON fields | Nested JSON object/array | TEXT (serialized JSON) | `serde_json::to_string()` |
| UUIDs | String | TEXT | No conversion needed |
| Enums | String | TEXT | No conversion needed |
| Dates | String (YYYY-MM-DD) | TEXT | No conversion needed |

### Bug: `pull.rs` line 173-176

```rust
let remote_updated_at = record
    .get("updated_at")
    .and_then(|v| v.as_i64())
    .unwrap_or(0);
```

Supabase Realtime delivers `updated_at` as an ISO 8601 string. `as_i64()` returns `None` for strings, so `remote_updated_at` is always 0. Conflict resolution always picks `Winner::Local`, silently discarding all remote updates. This must be fixed as part of the upsert implementation.

### Secondary Bug: `push.rs` line 90 (out of scope but noted)

`last_push_at` is set with `timestamp_millis()` but compared against `updated_at` which stores epoch seconds. Since millis >> seconds numerically, the filter `WHERE updated_at > ?` with a millis value means rows may be re-pushed every cycle. This does not affect pull and should be tracked as a separate bug.

## Key Decision 1: Dynamic Column Upsert Strategy

### Options Considered

**A. Per-table column mapping (hardcoded)**
Define a Rust struct or map for each of the 15 tables with column names and types. Type-safe but requires updating whenever schema changes. Rejected -- violates M2 requirement and creates maintenance burden.

**B. Dynamic column discovery via `pragma_table_info` (selected)**
Same pattern used by `push.rs`. At upsert time, query SQLite's `pragma_table_info` for the target table's columns and their declared types. Build the INSERT statement dynamically. Advantages:
- Already proven in the push path
- Zero maintenance when columns are added/removed via migrations
- Column types from pragma give enough signal for type coercion

**C. Schema registry at startup**
Cache all column metadata at `SyncEngine::new()` time. Avoids repeated pragma queries. Rejected for now -- pragma is fast (local SQLite, no I/O) and caching adds complexity. Can be added later if profiling shows it matters.

### Design: `coerce_value` function

A single function handles all type conversions based on SQLite's declared column type from `pragma_table_info`:

```rust
fn coerce_value(sqlite_type: &str, json_val: &Value) -> Value {
    match sqlite_type.to_uppercase().as_str() {
        "INTEGER" => {
            // Handle timestamps (ISO 8601 string -> epoch seconds)
            if let Some(s) = json_val.as_str() {
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
                    return Value::Number(dt.timestamp().into());
                }
                // Try other date formats Supabase might send
                if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f") {
                    return Value::Number(dt.and_utc().timestamp().into());
                }
            }
            // Handle booleans (true/false -> 1/0)
            if let Some(b) = json_val.as_bool() {
                return Value::Number((b as i64).into());
            }
            // Already a number -- pass through
            json_val.clone()
        }
        "TEXT" => {
            // Handle JSONB (nested object/array -> serialized string)
            if json_val.is_object() || json_val.is_array() {
                return Value::String(json_val.to_string());
            }
            // Already a string or null -- pass through
            json_val.clone()
        }
        "REAL" => {
            // Pass through numeric values
            json_val.clone()
        }
        _ => json_val.clone(),
    }
}
```

### Design: Dynamic INSERT ... ON CONFLICT

```rust
async fn upsert_row(pool: &SqlitePool, table: &str, record: &Value) -> Result<(), sqlx::Error> {
    // 1. Discover columns via pragma_table_info
    let columns: Vec<(String, String)> = sqlx::query_as(
        "SELECT name, type FROM pragma_table_info(?)"
    ).bind(table).fetch_all(pool).await?;

    // 2. Filter to columns present in the JSON record
    // 3. For each column, coerce the JSON value to match SQLite type
    // 4. Build: INSERT INTO {table} (col1, col2, ...) VALUES (?, ?, ...)
    //          ON CONFLICT(id) DO UPDATE SET col1=excluded.col1, col2=excluded.col2, ...
    // 5. Bind coerced values and execute
}
```

The `ON CONFLICT(id) DO UPDATE SET` clause excludes the `id` column itself (primary key is never updated).

## Key Decision 2: Force-Pull via Supabase REST API

### Approach

Force-pull iterates over `SYNCABLE_TABLES` and for each table:

1. Fetches all rows via `GET {supabase_url}/rest/v1/{table}?select=*` with auth headers
2. Paginates using the `Range` header (`Range: 0-999`, `Range: 1000-1999`, etc.) since Supabase defaults to 1000-row pages
3. For each batch, runs the same `upsert_row` (with coercion) for every record
4. Updates `sync_metadata.last_pull_at` for the table after all pages are processed
5. Emits `sync:data_changed` after each table completes

### State Transitions

```
Idle -> Pulling -> Idle         (success)
Idle -> Pulling -> Error        (failure, with message)
Offline -> Error("Not authenticated")  (no credentials)
```

Progress events emitted per table:
```json
{ "event": "sync:pull_progress", "table": "exercises", "status": "pulling" }
{ "event": "sync:pull_progress", "table": "exercises", "status": "done" }
```

### Placement in code

- Core pull logic: new function `pull_all` in `src-tauri/src/sync/pull.rs`
- Command handler: replace stub in `src-tauri/src/commands/sync.rs`
- Expose pool + credentials on SyncEngine (pool already exposed, credentials getter already exists)

## Key Decision 3: Timestamp Handling Strategy

The existing `updated_at` in SQLite is epoch seconds. Supabase sends ISO 8601. The `coerce_value` function handles conversion during upsert.

For conflict resolution in `upsert_row`, the fix:

```rust
// Before (broken):
let remote_updated_at = record.get("updated_at").and_then(|v| v.as_i64()).unwrap_or(0);

// After (fixed):
let remote_updated_at = parse_remote_timestamp(record.get("updated_at"));
```

Where `parse_remote_timestamp` tries:
1. `as_i64()` -- in case it's already numeric (from REST API responses)
2. `as_str()` then `chrono::DateTime::parse_from_rfc3339()` then `.timestamp()` -- for ISO 8601 from Realtime
3. Falls back to 0 if neither works (triggers Local wins, safe default)

## Key Decision 4: Initial Full-Pull on First Sign-In

When `set_auth` is called and the sync loop starts, the first cycle should check if `last_pull_at` is 0 for all tables. If so, trigger `pull_all` before the first push cycle. This ensures a new device gets populated before pushing potentially empty/stale local data.

Sequence in the sync loop:
```
1. Check if any last_pull_at == 0 (first-time check)
2. If yes: pull_all() first
3. push_all()
4. queue::flush()
5. Sleep 30s
6. Repeat from step 3 (step 1-2 only on first iteration)
```

## Files Modified

| File | Changes |
|------|---------|
| `src-tauri/src/sync/pull.rs` | Implement `upsert_row`, add `coerce_value`, add `parse_remote_timestamp`, add `pull_all` for force-pull, add `pull_table` helper |
| `src-tauri/src/sync/mod.rs` | Add `pull_all` call in sync loop for first-time detection; expose pull module's `pull_all` publicly |
| `src-tauri/src/commands/sync.rs` | Replace `sync_force_pull` stub with actual implementation calling `pull::pull_all` |
| `src/stores/sync-store.ts` | Add `pullProgress` state for per-table progress (optional, P1) |
| `src/components/sync-listener.tsx` | Listen for `sync:pull_progress` events (optional, P1) |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large table pull (thousands of rows) blocks the sync loop | Sync stalls during pull | Pagination + per-table progress events; pull runs sequentially per table, not all at once |
| Supabase Realtime reconnect after pull may re-send events | Duplicate upserts | `ON CONFLICT(id) DO UPDATE SET` is idempotent; same data upserted twice has no effect |
| Supabase REST API rate limiting on force-pull | Pull fails mid-way | Per-table tracking via `last_pull_at`; can resume from last successful table |
| `pragma_table_info` returns types as declared (e.g., "INTEGER" exactly) | Type coercion misses edge cases | SQLite type affinity means declared types are predictable; test with actual schema |
| Supabase sends null for nullable columns | SQLite insert fails for NOT NULL columns | Filter out null values for NOT NULL columns, or let SQLite handle defaults |

## ADR: None Required

The technical decisions here (dynamic column mapping, LWW, REST API pagination) are extensions of patterns already established in the push path. No new architectural direction is being set. The timestamp and type coercion decisions are implementation details forced by the existing schema choices.

If the `push.rs` millis-vs-seconds bug is addressed later, that may warrant an ADR about standardizing timestamp units across the sync engine.
