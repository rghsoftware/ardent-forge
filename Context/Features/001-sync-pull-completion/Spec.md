# 001 - Sync Pull Completion

## Overview

Complete the pull (remote-to-local) path of the sync engine by implementing the stubbed `upsert_row` function in `src-tauri/src/sync/pull.rs` and the `sync_force_pull` command in `src-tauri/src/commands/sync.rs`. This unblocks the Phase 1 GO/NO-GO checkpoint by enabling bidirectional sync.

## Problem Statement

The sync engine's push path (local SQLite to Supabase) is fully functional, but the pull path is incomplete:

1. **Pull upsert is stubbed** -- When the Supabase Realtime WebSocket delivers an INSERT or UPDATE, `upsert_row` runs conflict resolution (LWW) but never writes the winning remote record to local SQLite. The record is acknowledged and logged but silently discarded.

2. **Force-pull always errors** -- `sync_force_pull` returns `AppError::sync("Force pull is not yet implemented")` for all authenticated states. Users have no way to manually trigger a full data download from Supabase.

3. **No initial full-pull** -- When a user signs in on a new device (or after a wipe), there is no mechanism to download all existing data from Supabase. The Realtime subscription only captures changes after the WebSocket connects.

The net effect: data flows from the device to the cloud, but never back. A workout logged on the web or a second device never appears locally.

## User Stories

1. **As a user with multiple devices**, I want workouts logged on my phone to appear on all my devices (and vice versa) without manual intervention, so my training history is always complete regardless of which device I use.

2. **As a user signing in on a new device**, I want all my existing programs, templates, and workout history to download automatically, so I do not start from a blank state.

3. **As a user experiencing sync issues**, I want to trigger a force-pull that downloads everything from the cloud and overwrites stale local data, so I can recover from inconsistencies.

## Requirements

### Must Have (P0)

- **M1**: `upsert_row` writes the remote record to local SQLite when the remote wins LWW conflict resolution (or when no local record exists for the row).
- **M2**: Column discovery is dynamic (via `pragma_table_info`), matching the pattern already used by `push.rs`. No hardcoded column lists.
- **M3**: `upsert_row` uses `INSERT ... ON CONFLICT(id) DO UPDATE SET` to handle both new rows and updates atomically.
- **M4**: `sync_force_pull` fetches all rows for every table in `SYNCABLE_TABLES` from the Supabase REST API and upserts them into local SQLite.
- **M5**: Force-pull transitions through `SyncState::Pulling` and back to `Idle` (or `Error`) with proper state emissions.
- **M6**: After any successful pull (realtime or force), emit `sync:data_changed` so the frontend invalidates TanStack Query caches.
- **M7**: The `sync_metadata.last_pull_at` timestamp is updated per table after a successful force-pull.
- **M8**: All 15 tables in `SYNCABLE_TABLES` are supported.

### Should Have (P1)

- **S1**: Force-pull paginates large tables (Supabase REST API returns max 1000 rows by default) using `Range` headers or `offset`/`limit` query params.
- **S2**: Force-pull reports progress per table so the frontend can show meaningful status (e.g., "Pulling exercises... programs...").
- **S3**: Initial full-pull on first sign-in (when `last_pull_at` is 0 for all tables) is triggered automatically as part of the sync loop's first cycle.

### Won't Have (this scope)

- **W1**: Selective table pull (pull only specific tables) -- all tables are pulled together.
- **W2**: Incremental pull via REST API using `updated_at > last_pull_at` filtering -- the Realtime subscription handles ongoing incremental sync. Force-pull is always a full download.
- **W3**: Pull-side offline queue -- pull only happens when online by definition.
- **W4**: UI for choosing conflict resolution strategy -- LWW is the only strategy.

## Testable Assertions

| ID    | Assertion                                                                                                    | Validation Method                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| TA-1  | A row upserted via Realtime (INSERT) with no local counterpart is written to SQLite                          | Unit test: `upsert_row` with empty local table, verify row exists after                      |
| TA-2  | A row upserted via Realtime (UPDATE) where remote `updated_at` > local `updated_at` overwrites the local row | Unit test: seed local row, call `upsert_row` with newer remote, verify columns updated       |
| TA-3  | A row upserted via Realtime where local `updated_at` >= remote `updated_at` is skipped (no write)            | Unit test: seed local row, call `upsert_row` with older/equal remote, verify local unchanged |
| TA-4  | `upsert_row` dynamically discovers columns via `pragma_table_info` -- no hardcoded column lists              | Code review: verify no table-specific column enums or match arms                             |
| TA-5  | Force-pull downloads all rows for all 15 syncable tables and upserts them locally                            | Integration test: seed Supabase with known data, force-pull, verify local SQLite matches     |
| TA-6  | Force-pull with >1000 rows in a table paginates correctly                                                    | Integration test: seed table with 1500 rows, force-pull, verify all 1500 present locally     |
| TA-7  | Force-pull transitions state: Idle -> Pulling -> Idle (success) or Idle -> Pulling -> Error (failure)        | Unit test on state transitions                                                               |
| TA-8  | `sync:data_changed` event fires after successful realtime upsert                                             | Existing test in `sync-listener.tsx` covers frontend reaction; verify Rust emits event       |
| TA-9  | `last_pull_at` is updated in `sync_metadata` after successful force-pull per table                           | Unit test: verify timestamp advances after pull                                              |
| TA-10 | Force-pull while offline returns appropriate auth error                                                      | Unit test: call `sync_force_pull` with `SyncState::Offline`, verify error                    |

## Open Questions

1. **Timestamp units**: Push uses `chrono::Utc::now().timestamp_millis()` for `last_push_at`. Supabase `updated_at` columns are `timestamptz`. The pull path reads `updated_at` as `i64` via `record.get("updated_at").and_then(|v| v.as_i64())`. Need to verify whether Supabase Realtime delivers timestamps as epoch millis, ISO strings, or Postgres `timestamptz` format -- and handle conversion consistently.

2. **Supabase Realtime payload format**: The `record` field in Realtime messages -- does it include all columns or only changed columns? This affects whether `upsert_row` can build a complete INSERT. (Supabase Realtime with `replica identity full` sends all columns; default sends only changed + PK. Need to verify the project's replica identity setting.)

## Dependencies

- Step 8 (Tauri shell with SQLite): Complete
- Push path (`push.rs`): Complete, provides the `pragma_table_info` pattern to reuse
- Conflict resolution (`conflict.rs`): Complete and tested
- Supabase Realtime subscription (`pull.rs`): WebSocket connection and message routing complete
- Frontend sync bridge and listener: Complete, already reacts to `sync:data_changed`
