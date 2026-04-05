# Feature 012: TauriAdapter Unit Tests

**Status:** Draft
**Issue:** [#16](https://github.com/rghsoftware/ardent-forge/issues/16)
**Created:** 2026-04-04

## Overview

Add comprehensive unit test coverage for `TauriAdapter` (`src/lib/tauri-adapter.ts`, 2308 lines, 88 class methods + 30 standalone functions). This is the entire offline-first data path -- bugs here cause silent data loss for desktop users.

## Problem Statement

The TauriAdapter has zero test coverage. The SupabaseAdapter has comprehensive tests (1822 lines in `src/lib/__tests__/supabase-adapter.test.ts`). Both adapters implement the same `DataAdapter` interface, so the TauriAdapter should have equivalent coverage.

The TauriAdapter contains non-trivial logic in:

- Type conversion helpers (SQLite integers to booleans, JSON parsing, null guards)
- Error translation (`TauriAppError` to `AdapterError`)
- Row-to-domain mappers (20+ functions)
- Complex aggregation methods that compose multiple `invoke()` calls
- Argument serialization for Rust IPC

## User Stories

1. As a developer, I want TauriAdapter tests so regressions in the offline data path are caught before release.
2. As a developer, I want the test structure to mirror the SupabaseAdapter tests so both adapters are easy to compare and maintain.

## Requirements

### Must Have

- **M1:** Test all 4 conversion helpers: `intToBool()`, `parseJson()`, `requireString()`, `isoToUnixSeconds()`
- **M2:** Test `isTauriAppError` type guard and `AdapterError` error translation
- **M3:** Test `invokeCommand` wrapper (success path + error wrapping)
- **M4:** Test all 20+ row mapper functions (`toExerciseRow`, `toWorkoutLogRow`, etc.)
- **M5:** Test CRUD operations -- exercise, workout log, logged activity group/activity/set, user profile, 1RM history
- **M6:** Test complex aggregation methods: `getWorkoutLogFull`, `createWorkoutLogFull`, `getExerciseWorkoutHistory`, `getWeeklyVolume`, `getVaultSummary`
- **M7:** Test session template CRUD: `getSessionTemplates`, `getSessionTemplateFull`, `createSessionTemplateFull`, `updateSessionTemplateFull`, `deleteSessionTemplate`
- **M8:** Test program CRUD: `getPrograms`, `getProgramFull`, `createProgramFull`, `updateProgramFull`, `deleteProgram`
- **M9:** Test program activation methods: `getActiveProgram`, `setActiveProgram`, `updateActiveProgram`, `clearActiveProgram`
- **M10:** Test accountability group + member + invite methods
- **M11:** Test direct connection methods
- **M12:** Test chat/conversation methods: `createConversation`, `getConversations`, `sendMessage`, `getMessages`, `getUnreadCounts`, etc.
- **M13:** Mock `@tauri-apps/api/core` `invoke` function (same pattern as existing auth test mocks)
- **M14:** Test standalone helpers: `getMonday()`, `formatWeekLabel()`

### Should Have

- **S1:** Test filter argument serialization in `getExercises()` (category, movement pattern, search, custom-only filters)
- **S2:** Test error paths -- `invoke` rejecting with TauriAppError vs unknown error
- **S3:** Test null/undefined edge cases in row mappers (nullable columns)
- **S4:** Test methods that return `null` when entity not found (`getExercise`, `getWorkoutLog`, `getSessionTemplate`, etc.)

### Won't Have (this iteration)

- Integration tests with actual SQLite/Tauri runtime
- Performance benchmarks
- E2E tests through the UI layer

## Testable Assertions

- **TA1:** All conversion helpers produce correct output for representative inputs (including edge cases like null, 0, empty string)
- **TA2:** `AdapterError` correctly maps `TauriAppError` fields to `message`, `code`, `details`
- **TA3:** Every row mapper transforms a Tauri response interface into the correct domain Row type
- **TA4:** CRUD methods invoke the correct Tauri command name with the correct argument shape
- **TA5:** Aggregation methods compose multiple invoke results correctly (e.g. `getWorkoutLogFull` assembles log + groups + activities + sets)
- **TA6:** Methods that throw `not implemented` (event items, share links, clone) do so consistently
- **TA7:** `getExercises` passes filter arguments through to invoke correctly
- **TA8:** All tests pass (`bun run test`)

## Open Questions

None -- scope is well-defined by the issue and the existing SupabaseAdapter test precedent.

## Dependencies

- Existing `@tauri-apps/api/core` mock pattern (used in auth tests)
- `DataAdapter` interface and domain types from `src/lib/database.types.ts` / `src/domain/types/`
