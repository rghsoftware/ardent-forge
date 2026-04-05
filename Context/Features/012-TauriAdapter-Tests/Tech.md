# Feature 012: TauriAdapter Unit Tests -- Technical Plan

**Status:** Done
**Created:** 2026-04-04

## Architecture Overview

The test file `src/lib/__tests__/tauri-adapter.test.ts` will mock the Tauri IPC layer (`invoke` from `@tauri-apps/api/core`) and exercise every exported function and class method in `src/lib/tauri-adapter.ts`.

### Test Layer Diagram

```
[Test File]
    |
    +--> vi.mock('@tauri-apps/api/core') -- replaces invoke with vi.fn()
    |
    +--> import { TauriAdapter, AdapterError } from '../tauri-adapter'
    |
    +--> Each test:
           1. vi.mocked(invoke).mockResolvedValue(fixtureData)
           2. Call adapter method
           3. Assert return value shape + invoke called with correct cmd/args
```

## Key Technical Decisions

### KD1: Mock Strategy -- vi.mock at module level

**Decision:** Mock `@tauri-apps/api/core` with `vi.mock()` at the top of the file (before imports), exactly matching the pattern in `adapter.test.ts` and `config-store.test.ts`.

```ts
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))
```

**Why:** The `invokeCommand()` helper in tauri-adapter.ts imports `invoke` at module level. Vitest's hoisted `vi.mock()` intercepts this import before the module initializes, so all calls to `invoke` inside `invokeCommand` go through the mock.

**Alternative considered:** Manual dependency injection (pass `invoke` as a constructor param). Rejected because it would require changing production code solely for testability and diverge from the existing pattern.

### KD2: Fixture Design -- Tauri Response shapes, not Row shapes

**Decision:** Fixtures must use the `TauriXxxResponse` interface shapes (integers for booleans, JSON strings for object columns), NOT the `XxxRow` types from `database.types.ts`.

**Why:** The row mappers (`toExerciseRow`, etc.) are the code under test. If fixtures already used Row shapes, the mappers would be trivially passing data through. Using Tauri response shapes exercises the actual conversion logic (e.g., `intToBool(1)` -> `true`, `parseJson('{"a":1}', 'col')` -> `{a:1}`).

### KD3: Testing Unexported Functions

**Decision:** Test standalone helpers (`intToBool`, `parseJson`, `requireString`, `isoToUnixSeconds`, row mappers, `getMonday`, `formatWeekLabel`) indirectly through the class methods that use them.

**Why:** These functions are not exported from `tauri-adapter.ts`. Rather than exporting them solely for testing:

- Conversion helpers are exercised through row mapper assertions (verify the returned object has booleans, parsed objects, etc.)
- `invokeCommand` is exercised through every adapter method that delegates to Rust (not-implemented stubs throw errors without going through `invokeCommand`)
- `isTauriAppError` + `AdapterError` are exercised through error-path tests where `invoke` rejects with a `TauriAppError`-shaped object

If any helper has edge cases that can't be reached through public API (e.g., `parseJson` with malformed JSON), we can test that by having `invoke` return a response with an invalid JSON string field.

**Alternative considered:** Export helpers behind a `_testing` namespace. Rejected -- the indirect testing approach is sufficient and avoids polluting the module's public API.

### KD4: Test File Structure -- Mirror SupabaseAdapter

**Decision:** Organize tests in nested `describe` blocks matching the SupabaseAdapter test structure:

```
describe('TauriAdapter')
  describe('Conversion helpers (via mapped results)')
  describe('Error handling')
    describe('invokeCommand')
    describe('AdapterError')
  describe('Exercise operations')
    describe('getExercises')
    describe('getExercise')
    describe('createExercise')
  describe('Workout log operations')
    ...
  describe('Session template operations')
    ...
  describe('Program operations')
    ...
  describe('Program activation')
    ...
  describe('Accountability groups')
    ...
  describe('Direct connections')
    ...
  describe('Chat operations')
    ...
  describe('Analytics')
    describe('getWeeklyVolume')
    describe('getVaultSummary')
  describe('Standalone helpers')
    describe('getMonday')
    describe('formatWeekLabel')
  describe('Not-implemented stubs')
```

### KD5: Standalone Helpers Are Not Exported

**Decision:** `getMonday` and `formatWeekLabel` are standalone functions at the end of the file. They are NOT exported and are tested indirectly through `getWeeklyVolume`, which uses both.

### KD6: beforeEach Pattern

**Decision:** Each test gets a fresh adapter and cleared mocks:

```ts
let adapter: TauriAdapter

beforeEach(() => {
  vi.clearAllMocks()
  adapter = new TauriAdapter('user-001')
})
```

**Why:** Matches the SupabaseAdapter pattern. `vi.clearAllMocks()` resets call counts and return values, preventing test leakage.

## Stack-Specific Details

### Vitest Configuration

- Environment: `node` (no browser globals needed -- TauriAdapter is pure TypeScript)
- Setup file: `src/test/setup.ts` (Testing Library cleanup only, no Tauri setup)
- Alias: `@/` maps to `./src`
- Worktree exclusion: test file goes in `src/lib/__tests__/` which is included in the default test run

### Mock Patterns

| What                                 | How                                                                          | Where                |
| ------------------------------------ | ---------------------------------------------------------------------------- | -------------------- |
| `invoke` from `@tauri-apps/api/core` | `vi.mock()` + `vi.mocked(invoke).mockResolvedValue()`                        | Top of test file     |
| Error paths                          | `vi.mocked(invoke).mockRejectedValue({ kind: 'NOT_FOUND', message: '...' })` | Per-test             |
| Unknown errors                       | `vi.mocked(invoke).mockRejectedValue(new Error('network'))`                  | Error handling tests |

### Type Considerations

- Tauri response interfaces (`TauriExerciseResponse`, etc.) are not exported. Fixtures will use inline object literals typed to match the interface shapes.
- The `TauriAppError` interface is not exported either. Error fixtures use plain objects matching `{ kind, message, field? }`.

## Risks and Mitigations

| Risk                                       | Likelihood | Impact | Mitigation                                                                                           |
| ------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------- |
| Unexported types make fixtures fragile     | Medium     | Low    | Type assertions via `satisfies` where possible; tests will break on shape changes (which is desired) |
| Large test file (est. 2000+ lines)         | High       | Low    | Well-structured describe blocks; row fixtures at top; each domain section is independent             |
| `getMonday`/`formatWeekLabel` not exported | Medium     | Low    | Test indirectly through `getWeeklyVolume`; if insufficient coverage, extract to a utils file         |

## Integration Points

- **No external dependencies** beyond `@tauri-apps/api/core` mock
- **No database** needed (all SQLite access is behind `invoke`)
- **No network** needed (pure unit tests)
- Tests validate the contract between the TypeScript frontend and the Rust backend by asserting the exact command names and argument shapes passed to `invoke`
