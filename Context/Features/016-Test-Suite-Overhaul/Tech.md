# Feature 016: Test Suite Overhaul -- Technical Plan

## Open Question Resolutions

1. **Rust test strategy:** In-memory SQLite via `SqlitePoolOptions::new().connect(":memory:")`. This is already the established pattern in `sync/pull.rs`, `commands/chat.rs`, and others. Each test module defines its own `setup_test_db()` with inline DDL for exactly the tables it needs.

2. **Android framework:** Maestro for instrumentation tests (Should Have -- deferred to later iteration). Solo dev workflow benefits from YAML-based simplicity over Appium.

3. **CI runner:** `ubuntu-latest` with `dtolnay/rust-toolchain@stable` action. Cache `~/.cargo/registry`, `~/.cargo/git`, and `src-tauri/target/` keyed on `Cargo.lock` hash.

## Architecture Decisions

### Command Handler Testability Refactoring

All command handlers currently embed logic directly in the `#[tauri::command]` function, which takes `State<'_, SqlitePool>` (not constructible in tests). The fix is to extract an `_inner` function following the pattern already established in `commands/chat.rs`:

```rust
// Before (untestable)
#[tauri::command]
pub async fn get_exercises(
    pool: State<'_, SqlitePool>,
    filters: Option<ExerciseFilters>,
) -> Result<Vec<ExerciseRow>, AppError> {
    // ... 30 lines of logic ...
}

// After (testable)
#[tauri::command]
pub async fn get_exercises(
    pool: State<'_, SqlitePool>,
    filters: Option<ExerciseFilters>,
) -> Result<Vec<ExerciseRow>, AppError> {
    get_exercises_inner(pool.inner(), filters).await
}

pub(crate) async fn get_exercises_inner(
    pool: &SqlitePool,
    filters: Option<ExerciseFilters>,
) -> Result<Vec<ExerciseRow>, AppError> {
    // ... original logic moved here ...
}
```

This is a mechanical refactoring -- move the body to `_inner`, change `pool: State<'_, SqlitePool>` to `pool: &SqlitePool`, and replace `pool.inner()` references with just `pool`. The original command becomes a one-line wrapper.

**Files requiring this refactoring:** `exercises.rs`, `workout_logs.rs`, `programs.rs`, `session_templates.rs`, `sharing.rs`, `user_profile.rs`, `app_config.rs`, `guest.rs`, `notification.rs` (commands), `sync.rs` (commands), `rest_timer.rs` (commands)

### Test Module Structure

Each test module follows the established pattern:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("in-memory pool");
        sqlx::query("CREATE TABLE ...")
            .execute(&pool)
            .await
            .expect("create table");
        pool
    }

    #[tokio::test]
    async fn test_get_returns_empty_when_no_data() {
        let pool = setup_test_db().await;
        let result = get_foo_inner(&pool).await.unwrap();
        assert!(result.is_empty());
    }
}
```

- **Pure logic** (error.rs, models.rs, utils.rs, event_reminder, notification): plain `#[test]`
- **DB-dependent** (commands, db.rs): `#[tokio::test]` + in-memory SQLite
- **DDL inline** per module, only tables needed by that module
- **No shared test utilities** (following existing convention)

### CI Pipeline Addition

New `rust-tests` job in `.github/workflows/ci.yml`:

```yaml
rust-tests:
  name: Rust Tests & Clippy
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: src-tauri
  steps:
    - Checkout
    - dtolnay/rust-toolchain@stable with clippy component
    - Cache cargo registry + target
    - cargo clippy -- -D warnings
    - cargo test
```

Runs in parallel with existing `validate` and `e2e` jobs.

### E2E Test Expansion

Expand `e2e/` from 1 file (2 tests) to multiple spec files covering core flows. Use Supabase local stack (already in CI). Test data isolation via unique user accounts per test or cleanup in `afterEach`.

New spec files:

- `e2e/auth.spec.ts` -- sign up, sign in, sign out
- `e2e/exercises.spec.ts` -- create, search, filter exercises
- `e2e/workout.spec.ts` -- start session, log sets, complete workout
- `e2e/history.spec.ts` -- view workout history, workout detail

## Technology Choices

| Concern             | Decision                        | Rationale                                     |
| ------------------- | ------------------------------- | --------------------------------------------- |
| Rust test DB        | In-memory SQLite                | Established pattern, fast, isolated           |
| Command testability | `_inner` extraction             | chat.rs precedent, mechanical refactoring     |
| CI Rust toolchain   | `dtolnay/rust-toolchain@stable` | Standard, well-cached                         |
| CI Clippy           | `cargo clippy -- -D warnings`   | Convention from `.claude/rules/rust-tauri.md` |
| E2E framework       | Playwright (existing)           | Already in CI, no new deps                    |
| Coverage            | Deferred                        | S3 from spec -- nice to have, not blocking    |

## Risk Mitigation

- **Risk:** `_inner` extraction changes call sites incorrectly.
  **Mitigation:** `cargo build` after each file refactoring. The type system catches mismatches.

- **Risk:** Inline DDL in test modules drifts from actual migrations.
  **Mitigation:** Tests fail if DDL doesn't match what the command expects. This is a feature, not a bug -- it signals schema drift.

- **Risk:** E2E tests flaky due to timing.
  **Mitigation:** Use Playwright's built-in auto-wait, `expect` with timeouts, avoid `page.waitForTimeout()`.
