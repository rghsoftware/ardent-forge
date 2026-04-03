# 001 - Sync Pull Completion: Implementation Steps

## Team Composition

| Role | Agent Type | Domain |
|------|-----------|--------|
| Rust Sync Engineer | backend-engineer | `src-tauri/src/sync/`, `src-tauri/src/commands/` |
| Quality Engineer | quality-engineer | Validation of all deliverables |

This is a primarily Rust-side change. The frontend already reacts to `sync:data_changed` events. No frontend specialist needed unless P1 progress UI is added.

## Wave 1: Core Upsert Infrastructure (P0)

### S001: Implement `coerce_value` and `parse_remote_timestamp` helpers

**Agent**: Rust Sync Engineer
**Files**: `src-tauri/src/sync/pull.rs`
**Depends on**: Nothing

Add two helper functions to `pull.rs`:

1. `parse_remote_timestamp(val: Option<&Value>) -> i64` -- tries `as_i64()` first, then parses ISO 8601 via `chrono::DateTime::parse_from_rfc3339().timestamp()`, falls back to 0.

2. `coerce_value(sqlite_type: &str, json_val: &Value) -> Value` -- converts Supabase JSON types to SQLite-compatible JSON values:
   - INTEGER columns: ISO 8601 strings -> epoch seconds, booleans -> 0/1, numbers pass through
   - TEXT columns: nested JSON objects/arrays -> `serde_json::to_string()`, strings pass through
   - REAL columns: pass through
   - NULL: pass through as null

**Acceptance criteria**:
- [ ] Unit tests for `parse_remote_timestamp` with: i64 input, ISO 8601 string, ISO 8601 with fractional seconds, null, non-timestamp string
- [ ] Unit tests for `coerce_value` with: boolean->integer, ISO 8601->epoch seconds, nested JSON->TEXT, string->TEXT, null->null, number->number

---

### S002: Implement dynamic `upsert_row`

**Agent**: Rust Sync Engineer
**Files**: `src-tauri/src/sync/pull.rs`
**Depends on**: S001

Replace the stub in `upsert_row` (lines 185-190) with:

1. Fix timestamp parsing: replace `record.get("updated_at").and_then(|v| v.as_i64())` with `parse_remote_timestamp(record.get("updated_at"))`.
2. After conflict resolution (remote wins or no local record), discover columns via `pragma_table_info`.
3. Filter columns to those present in the JSON `record`.
4. For each column, call `coerce_value(sqlite_declared_type, json_value)`.
5. Build `INSERT INTO {table} ({cols}) VALUES ({placeholders}) ON CONFLICT(id) DO UPDATE SET {col}=excluded.{col}, ...` excluding `id` from the SET clause.
6. Bind coerced values positionally and execute.

**Acceptance criteria**:
- [ ] TA-1: INSERT with no local counterpart writes row to SQLite
- [ ] TA-2: UPDATE where remote is newer overwrites local row
- [ ] TA-3: UPDATE where local is newer/equal is skipped
- [ ] TA-4: No hardcoded column lists (code review)
- [ ] TA-8: `sync:data_changed` event fires (already wired in `handle_realtime_message`)

---

### S001-T: Unit tests for coerce_value and parse_remote_timestamp

**Agent**: Rust Sync Engineer
**Files**: `src-tauri/src/sync/pull.rs` (test module)
**Depends on**: S001

Write `#[cfg(test)]` tests covering:
- `parse_remote_timestamp` with ISO 8601, i64, null, garbage string
- `coerce_value("INTEGER", json!(true))` -> `json!(1)`
- `coerce_value("INTEGER", json!("2026-03-27T14:30:00+00:00"))` -> `json!(epoch_seconds)`
- `coerce_value("TEXT", json!({"a": 1}))` -> `json!("{\"a\":1}")`
- `coerce_value("TEXT", json!("hello"))` -> `json!("hello")`
- `coerce_value("INTEGER", json!(null))` -> `json!(null)`

---

### S002-T: Integration tests for upsert_row

**Agent**: Rust Sync Engineer
**Files**: `src-tauri/src/sync/pull.rs` (test module)
**Depends on**: S002

Write `#[tokio::test]` tests using an in-memory SQLite pool:
- Create a test table with columns matching a real syncable table schema (id TEXT, name TEXT, created_at INTEGER, updated_at INTEGER, is_custom INTEGER)
- Test INSERT (no prior row): verify all columns written, types correct
- Test UPDATE (remote newer): verify columns overwritten
- Test UPDATE (local newer): verify no changes
- Test with null values in optional columns

---

## Wave 2: Force-Pull Command (P0)

### S003: Implement `pull_table` and `pull_all` functions

**Agent**: Rust Sync Engineer
**Files**: `src-tauri/src/sync/pull.rs`
**Depends on**: S002

Add two new public functions:

1. `pull_table(pool, client, table, supabase_url, supabase_key, access_token, app_handle) -> Result<()>`
   - GET `{supabase_url}/rest/v1/{table}?select=*` with auth headers
   - Paginate: use `Range: 0-999` header, increment by 1000 until response has fewer than 1000 rows
   - For each row in each page, call `upsert_row(pool, table, &row)`
   - After all pages, update `sync_metadata.last_pull_at` for the table
   - Emit `sync:pull_progress` event with table name and status

2. `pull_all(pool, supabase_url, supabase_key, access_token, app_handle) -> Result<()>`
   - Create a `reqwest::Client`
   - Iterate `SYNCABLE_TABLES`, call `pull_table` for each
   - Return first error encountered (fail-fast)

**Acceptance criteria**:
- [ ] TA-5: All 15 tables pulled and upserted
- [ ] TA-6: Tables with >1000 rows paginate correctly
- [ ] TA-7: State transitions (tested via command handler in S004)
- [ ] TA-9: `last_pull_at` updated per table after success

---

### S004: Wire `sync_force_pull` command

**Agent**: Rust Sync Engineer
**Files**: `src-tauri/src/commands/sync.rs`
**Depends on**: S003

Replace the stub in `sync_force_pull`:

1. Check `SyncState::Offline` -> return auth error (already present)
2. Get credentials from state
3. Transition to `SyncState::Pulling`
4. Call `pull::pull_all(pool, url, key, token, app_handle)`
5. On success: transition to `SyncState::Idle`
6. On failure: transition to `SyncState::Error { message }`

**Acceptance criteria**:
- [ ] TA-7: State transitions work correctly
- [ ] TA-10: Offline state returns auth error
- [ ] Force-pull command no longer returns "not yet implemented"

---

## Wave 3: First-Sign-In Auto-Pull (P1)

### S005: Add initial pull to sync loop

**Agent**: Rust Sync Engineer
**Files**: `src-tauri/src/sync/mod.rs`
**Depends on**: S003

Modify `spawn_sync_loop` to check on the first iteration whether all `last_pull_at` values in `sync_metadata` are 0. If so, run `pull::pull_all` before the first push cycle.

Sequence:
```
First iteration:
  1. Check if needs_initial_pull (all last_pull_at == 0)
  2. If yes: transition to Pulling, run pull_all, transition to Idle
  3. Push phase (existing)
  4. Queue flush (existing)
Subsequent iterations:
  1. Push phase
  2. Queue flush
  3. Sleep 30s
```

**Acceptance criteria**:
- [ ] New device with empty SQLite gets populated on first sync cycle
- [ ] Subsequent cycles skip the initial pull check
- [ ] If initial pull fails, sync loop continues with push (does not abort)

---

### S005-T: Test initial pull detection

**Agent**: Rust Sync Engineer
**Files**: `src-tauri/src/sync/pull.rs` (or `mod.rs` test module)
**Depends on**: S005

Test the `needs_initial_pull` check:
- All `last_pull_at == 0` -> returns true
- Any `last_pull_at > 0` -> returns false
- Empty `sync_metadata` table -> returns true (safe default)

---

## Wave 4: Validation

### S006-V: Quality validation of all deliverables

**Agent**: Quality Engineer
**Files**: All modified files
**Depends on**: S001, S002, S003, S004, S005

Validate:
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo test` passes (all new and existing tests)
- [ ] No hardcoded column lists in pull.rs (TA-4)
- [ ] Conflict resolution correctly parses ISO 8601 timestamps
- [ ] Boolean and JSONB coercion verified in test output
- [ ] Force-pull command returns success (not "not implemented")
- [ ] State transitions emit correct events
- [ ] `sync:data_changed` fires on successful upsert

---

## Milestone Summary

| Wave | Tasks | Parallel? | Gate |
|------|-------|-----------|------|
| 1 | S001, S002, S001-T, S002-T | S001 then S002 (sequential); tests parallel with impl | All unit tests pass |
| 2 | S003, S004 | Sequential (S003 then S004) | Force-pull command works |
| 3 | S005, S005-T | Sequential | Auto-pull on first sign-in |
| 4 | S006-V | After all above | Clippy clean, all tests green |

## Execution Recommendation

**Use `/build`** (not `/team-build`). This is single-domain work (Rust only) with no cross-domain coordination needed. One Rust specialist agent can handle all waves sequentially. Quality engineer validates at the end.

Estimated files touched: 3 (pull.rs, mod.rs, commands/sync.rs). Optional P1 frontend: 2 more (sync-store.ts, sync-listener.tsx).
