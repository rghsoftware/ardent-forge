# Feature 016: Test Suite Overhaul -- Implementation Steps

## Phase 1: CI Pipeline (M4, S4)

### Step 1.1: Add Rust tests + clippy job to CI

- **File:** `.github/workflows/ci.yml`
- **Action:** Add `rust-tests` job that runs in parallel with existing `validate` and `e2e` jobs
- **Details:**
  - Use `dtolnay/rust-toolchain@stable` with `clippy` component
  - Cache `~/.cargo/registry`, `~/.cargo/git`, `src-tauri/target/` keyed on `Cargo.lock`
  - Run `cargo clippy -- -D warnings` then `cargo test` in `src-tauri/` working directory
- **Acceptance:** CI pipeline has 3 parallel jobs; Rust job passes on current codebase

## Phase 2: Rust Infrastructure Tests (M2)

### Step 2.1: Tests for error.rs

- **File:** `src-tauri/src/error.rs`
- **Action:** Add `#[cfg(test)]` module testing `AppError` construction, Display impl, error code mapping
- **Acceptance:** `cargo test` passes, error type round-trips verified

### Step 2.2: Tests for models.rs

- **File:** `src-tauri/src/models.rs`
- **Action:** Add `#[cfg(test)]` module testing serde serialization/deserialization round-trips for key model structs
- **Acceptance:** `cargo test` passes, serde round-trips verified

### Step 2.3: Tests for utils.rs

- **File:** `src-tauri/src/utils.rs`
- **Action:** Add `#[cfg(test)]` module testing all helper functions
- **Acceptance:** `cargo test` passes

### Step 2.4: Tests for db.rs

- **File:** `src-tauri/src/db.rs`
- **Action:** Add `#[cfg(test)]` module testing connection creation with in-memory SQLite
- **Acceptance:** `cargo test` passes

## Phase 3: Flesh Out Empty Test Modules (M3)

### Step 3.1: commands/chat.rs tests

- **File:** `src-tauri/src/commands/chat.rs`
- **Action:** The `#[cfg(test)]` module exists with `setup_test_db()` and `seed_direct_conversation()` but zero `#[test]` functions. Add tests for: `create_conversation_inner`, `get_conversations_inner`, `send_message_inner`, `get_messages_inner`, `leave_conversation_inner`, `get_unread_counts_inner`
- **Acceptance:** >= 6 test functions, all passing

### Step 3.2: rest_timer.rs tests

- **File:** `src-tauri/src/rest_timer.rs`
- **Action:** Has `#[cfg(test)]` but no tests. Add tests for timer state transitions, expiry logic
- **Acceptance:** >= 2 test functions, all passing

### Step 3.3: sync/mod.rs tests

- **File:** `src-tauri/src/sync/mod.rs`
- **Action:** Has `#[cfg(test)]` but no tests. Add tests for sync metadata read/write
- **Acceptance:** >= 2 test functions, all passing

### Step 3.4: sync/push.rs tests

- **File:** `src-tauri/src/sync/push.rs`
- **Action:** Has `#[cfg(test)]` but no tests. Add tests for push payload construction, allowlist filtering
- **Acceptance:** >= 3 test functions, all passing

### Step 3.5: sync/queue.rs tests

- **File:** `src-tauri/src/sync/queue.rs`
- **Action:** Has `#[cfg(test)]` but no tests. Add tests for queue enqueue/dequeue, ordering, deduplication
- **Acceptance:** >= 3 test functions, all passing

## Phase 4: Command Handler Refactoring + Tests (M1)

Each step follows the same pattern:

1. Extract all `#[tauri::command]` bodies to `pub(crate) async fn ..._inner(&SqlitePool, ...)` functions
2. Original command becomes a one-line wrapper calling the inner function
3. Add `#[cfg(test)]` module with `setup_test_db()` and tests for each inner function
4. Verify `cargo build` passes after refactoring, `cargo test` passes after adding tests

### Step 4.1: exercises.rs refactor + tests

- **File:** `src-tauri/src/commands/exercises.rs` (168 lines)
- **Functions:** `get_exercises`, `get_exercise`, `create_exercise`, `update_exercise`, `delete_exercise`
- **Acceptance:** >= 5 test functions, all passing

### Step 4.2: app_config.rs refactor + tests

- **File:** `src-tauri/src/commands/app_config.rs` (82 lines)
- **Functions:** `get_app_config`, `set_app_config`, `delete_app_config`
- **Acceptance:** >= 3 test functions, all passing

### Step 4.3: user_profile.rs refactor + tests

- **File:** `src-tauri/src/commands/user_profile.rs` (150 lines)
- **Functions:** `get_user_profile`, `upsert_user_profile`
- **Acceptance:** >= 3 test functions, all passing

### Step 4.4: guest.rs refactor + tests

- **File:** `src-tauri/src/commands/guest.rs` (55 lines)
- **Functions:** Guest mode handlers
- **Acceptance:** >= 2 test functions, all passing

### Step 4.5: notification.rs (commands) refactor + tests

- **File:** `src-tauri/src/commands/notification.rs` (63 lines)
- **Functions:** Notification preference handlers
- **Acceptance:** >= 2 test functions, all passing

### Step 4.6: rest_timer.rs (commands) refactor + tests

- **File:** `src-tauri/src/commands/rest_timer.rs` (33 lines)
- **Functions:** Rest timer command wrappers
- **Acceptance:** >= 2 test functions, all passing

### Step 4.7: workout_logs.rs refactor + tests

- **File:** `src-tauri/src/commands/workout_logs.rs` (928 lines)
- **Functions:** `get_workout_logs`, `get_workout_log`, `get_workout_log_full`, `create_workout_log_full`, `delete_workout_log`, `get_exercise_workout_history`, `get_weekly_volume`, plus logged activity/group/set CRUD
- **Acceptance:** >= 10 test functions, all passing

### Step 4.8: session_templates.rs refactor + tests

- **File:** `src-tauri/src/commands/session_templates.rs` (493 lines)
- **Functions:** `get_session_templates`, `get_session_template_full`, `create_session_template_full`, `update_session_template_full`, `delete_session_template`
- **Acceptance:** >= 6 test functions, all passing

### Step 4.9: programs.rs refactor + tests

- **File:** `src-tauri/src/commands/programs.rs` (789 lines)
- **Functions:** `get_programs`, `get_program_full`, `create_program_full`, `update_program_full`, `delete_program`, `get_active_program`, `set_active_program`, `update_active_program`, `clear_active_program`
- **Acceptance:** >= 8 test functions, all passing

### Step 4.10: sharing.rs refactor + tests

- **File:** `src-tauri/src/commands/sharing.rs` (1120 lines)
- **Functions:** Accountability groups, members, invites, direct connections, share links
- **Acceptance:** >= 10 test functions, all passing

### Step 4.11: sync.rs (commands) refactor + tests

- **File:** `src-tauri/src/commands/sync.rs` (101 lines)
- **Functions:** Sync trigger/status command wrappers
- **Acceptance:** >= 3 test functions, all passing

## Phase 5: E2E Test Expansion (M5, M6)

### Step 5.1: Auth E2E tests

- **File:** `e2e/auth.spec.ts` (new)
- **Tests:** Sign-up flow, sign-in flow, sign-out, redirect to sign-in when unauthenticated
- **Acceptance:** >= 3 tests, all passing against local Supabase

### Step 5.2: Exercise E2E tests

- **File:** `e2e/exercises.spec.ts` (new)
- **Tests:** Create custom exercise, search exercises, filter by category
- **Acceptance:** >= 3 tests, all passing

### Step 5.3: Workout logging E2E tests

- **File:** `e2e/workout.spec.ts` (new)
- **Tests:** Start workout session, log a set, complete workout, view summary
- **Acceptance:** >= 3 tests, all passing

### Step 5.4: History E2E tests

- **File:** `e2e/history.spec.ts` (new)
- **Tests:** View workout history list, open workout detail
- **Acceptance:** >= 2 tests, all passing

## Phase 6: Validation

### Step 6.1: Full test suite validation

- Run `cargo test` in `src-tauri/` -- all pass
- Run `cargo clippy -- -D warnings` in `src-tauri/` -- no warnings
- Run `bun run test` -- all 1925+ TS tests pass (no regressions)
- Run `bun run test:e2e` -- all E2E tests pass
- Verify total Rust test count >= 80 (up from 37)
- Verify E2E test count >= 10 (up from 2)

### Step 6.2: CI dry run

- Push branch, verify all 3 CI jobs (validate, e2e, rust-tests) pass
