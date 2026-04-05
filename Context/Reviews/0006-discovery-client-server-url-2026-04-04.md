# PR Review: discovery-client-server-url

**Date:** 2026-04-04
**Feature:** Context/Features/009-discovery-client-server-url/
**Branch:** worktree-feat+discovery-client-server-url
**Reviewers:** code-reviewer, pr-test-analyzer, silent-failure-hunter, comment-analyzer, type-design-analyzer
**Status:** 🟢 Resolved

## Summary

18 findings across 5 review agents. 4 critical (logging, error handling, schema weakness), 6 important (a11y, race condition, error type mismatches, misleading docs), 8 suggestions (type extraction, test gaps, comment refinements). The discovery client logic is well-structured and thoroughly tested; the main concerns are around error observability, defensive error handling in the UI layer, and Zod schema leniency at the system boundary.

## Findings

### Fix-Now

#### [FIX] P6-001: Zero logging in discovery.ts -- all 5 error paths are silent
- **File:** src/lib/discovery.ts (entire file)
- **Severity:** Critical
- **Detail:** The file has 5 distinct error return paths and zero console.error/console.warn calls. Every other error-handling file in the codebase follows the `console.error('[prefix]', err)` convention. Discovery failures will be invisible in the dev console, making debugging impossible when users report "discovery didn't work."
- **Status:** ✅ Fixed
- **Resolution:** Added `console.error('[discovery]', ...)` logging to all 6 error paths (URL parse, protocol check, fetch failure, HTTP error, JSON parse, schema validation).

#### [FIX] P6-002: Bare `catch {}` blocks discard error objects entirely
- **File:** src/lib/discovery.ts:32, src/lib/discovery.ts:82
- **Severity:** Critical
- **Detail:** Both the URL-parsing catch (line 32) and the JSON-parsing catch (line 82) use parameterless `catch {}`. The actual error object is thrown away. Non-obvious failures (body already consumed, memory pressure, browser extension interference) become untraceable. Capture the error parameter and log it.
- **Status:** ✅ Fixed
- **Resolution:** Changed both bare `catch {}` to `catch (err)` with `console.error` logging.

#### [FIX] P6-003: Wrong error type `NETWORK_ERROR` for URL parse failure
- **File:** src/lib/discovery.ts:32-38
- **Severity:** High
- **Detail:** When `new URL(normalized)` throws (invalid URL syntax), the code returns `error: 'NETWORK_ERROR'`. This is a validation error, not a network error. If a caller ever branches on error type to decide whether to retry, malformed URLs would be retried as if they were transient network problems.
- **Status:** ✅ Fixed
- **Resolution:** Added `INVALID_INPUT` to `DiscoveryError` union. URL parse and protocol check errors now return `INVALID_INPUT`. Updated tests accordingly.

#### [FIX] P6-004: Wrong error type `NOT_FOUND` for JSON parse failure
- **File:** src/lib/discovery.ts:83-89
- **Severity:** High
- **Detail:** When `response.json()` fails on a 200 response (e.g., HTML page from a generic web server), the error type is `NOT_FOUND`. But the endpoint WAS found (HTTP 200); the body is just not JSON. Should be `INVALID_RESPONSE` to match semantic intent and align with the schema validation failure on line 94.
- **Status:** ✅ Fixed
- **Resolution:** Changed JSON parse failure error type from `NOT_FOUND` to `INVALID_RESPONSE`. Updated test expectation.

#### [FIX] P6-005: Misleading JSDoc -- "passed directly to createClient"
- **File:** src/lib/discovery.ts:19-20
- **Severity:** Medium
- **Detail:** The JSDoc states credentials "can be passed directly to `createClient`" but the actual consumer pattern is `validateConnection` then `initSupabaseFromConfig`. A future maintainer reading this might bypass the config store and initialization flow, producing a disconnected client instance. Replace with "can be passed to `validateConnection` and then persisted via the config store."
- **Status:** ✅ Fixed
- **Resolution:** Updated JSDoc to reference `validateConnection` and config store instead of `createClient`.

#### [FIX] P6-006: Missing `aria-expanded` on manual configuration toggle
- **File:** src/routes/setup.tsx:196-203
- **Severity:** High
- **Detail:** The disclosure button that toggles the advanced/manual section lacks `aria-expanded={advancedOpen}` and `aria-controls`. Screen readers cannot communicate the expanded/collapsed state to users. The `.claude/rules/react-typescript.md` accessibility guideline requires interactive elements to be fully keyboard/screen-reader accessible.
- **Status:** ✅ Fixed
- **Resolution:** Added `aria-expanded={advancedOpen}` and `aria-controls="manual-config-section"` to toggle button, plus `id="manual-config-section"` on the controlled panel.

#### [FIX] P6-007: No double-submission guard on handleDiscoverAndConnect
- **File:** src/routes/setup.tsx:84
- **Severity:** Medium
- **Detail:** The Connect button disables during `discovering`/`validating` states (line 161), but `handleDiscoverAndConnect` itself has no early-return guard. Rapid clicks or keyboard events before React re-renders could trigger concurrent discovery+validation flows, causing a race condition on shared state.
- **Status:** ✅ Fixed
- **Resolution:** Added early-return guard `if (discoveryStatus === 'discovering' || status === 'validating') return` at the top of `handleDiscoverAndConnect`.

#### [FIX] P6-008: Comment scope mismatch on validation feedback
- **File:** src/routes/setup.tsx:178
- **Severity:** Low
- **Detail:** Comment says "(shown after discovery succeeds)" but the feedback block is shared by both the discovery and manual flows. Change to "(shared by both discovery and manual flows)."
- **Status:** ✅ Fixed
- **Resolution:** Updated comment to "(shared by both discovery and manual flows)".

### Missing Tasks

#### [TASK] P6-009: No top-level try-catch in handleDiscoverAndConnect
- **File:** src/routes/setup.tsx:84-109
- **Severity:** Critical
- **Detail:** If `discoverInstance` or `validateAndSave` throws an unexpected runtime error (TypeError, programming bug), the promise rejection propagates unhandled. React does not catch async errors from event handlers. The UI freezes permanently in "discovering" state with no error feedback and no recovery path. Wrap the entire body in a try-catch that resets to an error state.
- **Relates to:** TA-7, TA-8
- **Status:** ✅ Fixed inline
- **Resolution:** Implemented as part of SetupState refactor. `handleDiscoverAndConnect` now wrapped in try-catch that resets to `discovery-failed` phase. Task S005 no longer needed.

#### [TASK] P6-010: No top-level try-catch in handleConnect
- **File:** src/routes/setup.tsx:74-82
- **Severity:** High
- **Detail:** Same pattern as P6-009. If `validateAndSave` throws unexpectedly, the UI stays stuck in "validating" state. Wrap in try-catch with fallback error state.
- **Relates to:** TA-10
- **Status:** ✅ Fixed inline
- **Resolution:** Implemented as part of SetupState refactor. `handleConnect` now wrapped in try-catch that resets to `validation-failed` phase. Task S006 no longer needed.

#### [TASK] P6-011: validateAndSave sets success state before async operations complete
- **File:** src/routes/setup.tsx:51-66
- **Severity:** High
- **Detail:** The try block wraps 4 operations (state update, config persistence, Supabase init, navigation) in one catch. `setStatus('ok')` fires at the top of the block. If `initSupabaseFromConfig` or `router.navigate` throws, the user sees a success flash followed by a misleading "Connected but failed to save" error. Move success state to after all async operations complete.
- **Relates to:** TA-11
- **Status:** ✅ Fixed inline
- **Resolution:** Implemented as part of SetupState refactor. `setState({ phase: 'success' })` now fires after `setConfig` and `initSupabaseFromConfig` complete. Task S007 no longer needed.

#### [TASK] P6-012: Tighten DiscoverySchema Zod validators
- **File:** src/lib/discovery.ts:9-13
- **Severity:** Critical
- **Detail:** `DiscoverySchema` uses bare `z.string()` for all three fields. The downstream `backendConfigSchema` uses `z.string().url()` and `z.string().min(1)`. A discovery response with `supabase_url: ""` or `supabase_url: "not-a-url"` passes discovery validation, then fails later with confusing errors. Validation should be strictest at the system boundary. Use `z.string().url()` for `supabase_url`, `z.string().min(1)` for `supabase_publishable_key` and `version`.
- **Relates to:** TA-5
- **Status:** ✅ Task created
- **Resolution:** Added as S005 in Steps.md

#### [TASK] P6-013: Add test for missing supabase_publishable_key
- **File:** src/lib/__tests__/discovery.test.ts
- **Severity:** Medium
- **Detail:** Tests cover missing `version` and `supabase_url` but not missing `supabase_publishable_key` -- the most security-sensitive field. The spec (Steps.md S001-T, test case 10) explicitly requires it. A regression making this field optional would go undetected.
- **Relates to:** TA-5
- **Status:** ✅ Task created
- **Resolution:** Added as S005-T in Steps.md

#### [TASK] P6-014: Add test for non-404 HTTP errors (e.g., 500)
- **File:** src/lib/__tests__/discovery.test.ts
- **Severity:** Low
- **Detail:** Only 404 is tested. The code handles all non-2xx via `!response.ok`. A 500 test would verify the dynamic status-code message template (`Server returned ${response.status}...`) and prevent regressions if someone narrows the branch to only handle 404.
- **Relates to:** TA-4
- **Status:** ✅ Task created
- **Resolution:** Added as S006-T in Steps.md

#### [TASK] P6-015: Add test for URL with path component
- **File:** src/lib/__tests__/discovery.test.ts
- **Severity:** Low
- **Detail:** `forge.example.com/app` silently strips `/app` via `parsed.origin`. This is correct behavior per the spec, but it is a non-obvious transformation. A test documenting this behavior would prevent accidental regressions and serve as documentation.
- **Relates to:** TA-1, TA-2
- **Status:** ✅ Task created
- **Resolution:** Added as S007-T in Steps.md

### Architectural Concerns

#### [ADR] P6-016: Two parallel state machines with implicit coordination in setup.tsx
- **File:** src/routes/setup.tsx:38-40
- **Severity:** Medium
- **Detail:** `discoveryStatus` + `discoveryMessage` and `status` + `message` are four separate `useState` calls forming a de facto compound state machine. Impossible states are representable (e.g., `discoveryStatus === 'discovery-failed'` with `status === 'ok'`). As the page gains more features (QR scanning, deep links), this will become harder to reason about. Consider unifying into a single discriminated union `SetupState` type. Lower priority -- acceptable to defer to a future refactor if needed.
- **Relates to:** Tech.md, future Refactor B (QR code)
- **Status:** ✅ Fixed inline
- **Resolution:** Unified 4 state variables into a single `SetupState` discriminated union with 7 phases (idle, discovering, discovery-failed, validating, validation-failed, schema-missing, success). Impossible states eliminated. QR scanning (Refactor B) extends by adding `| { phase: 'scanning' } | { phase: 'scan-failed'; error: string }` to the union.

### Convention Gaps

#### [RULE] P6-017: Error type semantics -- NETWORK_ERROR used for non-network failures
- **Files:** src/lib/discovery.ts:36, src/lib/discovery.ts:44
- **Severity:** Medium
- **Detail:** `NETWORK_ERROR` is used for URL validation failures (bad syntax, wrong protocol) which are input errors, not network errors. The `DiscoveryError` union should include `INVALID_INPUT` for input validation failures. This pattern could recur in future client modules that contact external services. Consider adding a convention note to `.claude/rules/` about error type semantics at system boundaries.
- **Suggested rule:** `.claude/rules/error-handling.md` -- "Error types at system boundaries must distinguish input validation failures from network/transport failures."
- **Status:** ✅ Rule updated
- **Resolution:** Added to `.claude/rules/error-handling.md` (new file). Code fix applied in P6-003.

#### [RULE] P6-018: Bare catch blocks without error parameter
- **Files:** src/lib/discovery.ts:32, src/lib/discovery.ts:82
- **Severity:** Medium
- **Detail:** Two catch blocks use `catch {}` with no parameter, discarding the error object entirely. The codebase convention elsewhere is `catch (err)` with `console.error`. This should be codified as a rule so linting or review catches it automatically.
- **Suggested rule:** `.claude/rules/error-handling.md` -- "Never use bare `catch {}`. Always capture the error parameter and log it with a bracketed module prefix."
- **Status:** ✅ Rule updated
- **Resolution:** Added to `.claude/rules/error-handling.md` (new file). Code fix applied in P6-002.

## Resolution Summary
**Resolved at:** 2026-04-04
**Session:** Review resolution for discovery-client-server-url

| Category | Total | Fixed | Tasks Created | ADRs | Rules | Dismissed | Deferred |
|---|---|---|---|---|---|---|---|
| [FIX] | 8 | 8 | -- | -- | -- | -- | -- |
| [TASK] | 7 | 3 | 4 | -- | -- | -- | -- |
| [ADR] | 1 | 1 | -- | -- | -- | -- | -- |
| [RULE] | 2 | -- | -- | -- | 2 | -- | -- |
| **Total** | **18** | **12** | **4** | **0** | **2** | **0** | **0** |

Notes:
- P6-009, P6-010, P6-011 (TASK) were resolved inline as part of the SetupState discriminated union refactor rather than deferred to new tasks
- P6-016 (ADR) was resolved inline per user decision -- no separate ADR created
- Remaining tasks (S005, S005-T, S006-T, S007-T) are for schema tightening and test coverage additions

## Resolution Checklist
- [x] All [FIX] findings resolved (P6-001 through P6-008)
- [x] All [TASK] findings resolved or tracked (P6-009 through P6-015)
- [x] All [ADR] findings resolved (P6-016 -- fixed inline)
- [x] All [RULE] findings applied (P6-017, P6-018)
- [x] Review verified by review-verify agent
