# PR Review: worktree-feat+multipe-instance-display -> develop (F019 scope)

**Date:** 2026-04-07
**Feature:** Context/Features/019-Display-Setup-UX/
**Branch:** worktree-feat+multipe-instance-display
**PR:** #91
**Reviewers:** code-reviewer, silent-failure-hunter, pr-test-analyzer, type-design-analyzer, comment-analyzer
**Status:** Resolved

## Summary

56 findings across 5 review agents, scoped to the 5 unpushed commits on top of the already-reviewed F018 base (main target: `2cb69e1 feat(display): display setup UX and dispatcher routing (F019)`). F019 is in strong shape overall — excellent test coverage (27 test files for 17 new modules), disciplined `[module-name]` logging, and load-bearing "comments explain why" documentation. The Critical items are all silent-failure closures on new user-action paths (createGym, leave/join/delete, config backfill). The main architectural concern is ADR-013's silent deferral: the ADR was authored in this branch and declared F019 the `GymId` brand migration site, but the implementation shipped with raw strings and six new untyped consumers. 44 fix-now items, 9 missing test/refactor tasks, 2 architectural concerns, 1 convention gap. 32 of the 56 were captured from the agents' suggestion lists during interactive bulk triage.

## Findings

### Fix-Now

#### [FIX] P15-001: `createGym` mutation has no `onError` callback on the F019 personal-display CTA

- **File:** src/components/display/display-setup-panel.tsx:84-97, src/components/display/display-chooser.tsx:30-42
- **Severity:** Critical
- **Detail:** Both call sites fire `createGym.mutate({ name }, { onSuccess: ... })` with no `onError`. The mutation's `isError` renders an inline error, but there is zero `console.error` for the failure path. PG `23505` (duplicate name collision from `derivePersonalGymName`), `42501` (RLS), `OnlineRequiredError` (Tauri offline), and supabase network blips all produce the same "something went wrong" UI with no production trace. Violates `.claude/rules/error-handling.md` user-action guard clause rule.
- **Status:** Fixed
- **Resolution:** Added `onError` callbacks logging `[display-setup-panel]` / `[display-chooser]` prefixed errors to both call sites.

#### [FIX] P15-002: `handleLeave` / `handleJoin` / `handleDeleteConfirm` fire mutations with no error logging

- **File:** src/components/profile/gym-management-section.tsx:94-96 (leave), :99-105 (delete), :355-357 (join)
- **Severity:** Critical
- **Detail:** Three user-action handlers call `mutate()` without an `onError` callback. JSX later renders `gymErrorMessage(leaveGym.error, 'leave')`, which is a user-facing surface, but there is no corresponding `console.error` logging the actual error object. Operators investigating "user reports failed leave" have no PG code, no message body, and no gym/user IDs in traces. Fix: add `onError: (err) => console.error('[gym-mgmt] leaveGym failed', { gymId: gym.id }, err)` to each of the three handlers.
- **Status:** Fixed
- **Resolution:** Added `[gym-mgmt]`-prefixed `onError` callbacks to leaveGym, deleteGym, and joinGym mutations, each logging the gymId and error object.

#### [FIX] P15-003: Dispatcher error state swallows the underlying `gymsQuery.error`

- **File:** src/components/display/display-dispatcher.tsx:32 (and src/components/display/dispatcher-state.ts:48)
- **Severity:** Critical
- **Detail:** When `gymsQuery.isError` is true, the dispatcher constructs `{ kind: 'error', retry: gymsQuery.refetch }` and renders a generic "Could not load your gyms / Check your connection and try again." The actual error object (`gymsQuery.error`) is never logged anywhere on this path. RLS denial, schema drift, expired publishable key, and transient network blips all collapse to the same blank UI with zero console output. Violates `.claude/rules/error-handling.md` "Query Hook Error States" rule. Fix: add `useEffect(() => { if (gymsQuery.isError) console.error('[display-dispatcher] gyms query failed', gymsQuery.error) }, [gymsQuery.isError, gymsQuery.error])` in `DisplayDispatcher`, mirroring the pattern in `gym-management-section.tsx:329-336`.
- **Status:** Fixed
- **Resolution:** Added `useEffect` logging `[display-dispatcher] gyms query failed` with the error object on transition.

#### [FIX] P15-004: `BackfillForm.handleSave` catches `store.setConfig` failures in the outer catch with no specific log

- **File:** src/components/profile/show-display-panel.tsx:165-205
- **Severity:** Critical
- **Detail:** The outer `try { ... } catch (err)` catches three distinct failure surfaces (`discoverInstance` rejection, `store.getConfig` returning null, `store.setConfig` throwing) and produces a single generic "Unexpected error" message. The `store.setConfig` path is the most production-critical — Tauri SQLite write quota exhaustion or broken Tauri plugin handle will fail here — and there is no specific log identifying that the persist step failed. Wrap `store.setConfig(merged)` in its own try/catch with a `[display-setup] Backfill: setConfig failed` log and a user-facing "Failed to save the repaired configuration. Try again or restart the app." message, so Tauri SQLite write failures are debuggable from traces.
- **Status:** Fixed
- **Resolution:** Wrapped `store.setConfig(merged)` in its own try/catch with a dedicated `[show-display-panel] Backfill: setConfig failed` log and user-facing persist-specific error message.

#### [FIX] P15-005: `display-publisher.ts` try/catch rationale comment is above the wrong block

- **File:** src/lib/display-publisher.ts:106-109
- **Severity:** High
- **Detail:** The comment "Wrap responder invocation in try/catch — the responder may call republishCurrentState() which can throw, and Supabase Realtime swallows exceptions inside `on` callbacks in some versions. Logging here ensures the failure is traceable instead of silently lost." sits at lines 106-109, above the no-responder early-return block at lines 110-118. The actual `try {` it describes is at line 119. A reader hitting the comment will expect a try/catch next and instead see a null-check early return. Move the comment to directly above line 119, or reframe it as a "two guard clauses before invocation" preamble covering both branches in reading order.
- **Status:** Fixed
- **Resolution:** Moved the try/catch rationale comment to directly above the `try {` block.

#### [FIX] P15-006: `ShowDisplayPanel.onToggle` prop is declared, passed, and never used

- **File:** src/components/profile/show-display-panel.tsx:30-38 (declaration), src/components/profile/gym-management-section.tsx:295 (call site)
- **Severity:** High
- **Detail:** `ShowDisplayPanelProps` includes `onToggle: () => void`, but the function signature destructures only `{ gym, isOpen }` and the body never invokes it. `MyGymRow` in `gym-management-section.tsx:295` passes `onToggle={onToggleDisplay}`, which is dead wiring. The docblock comment ("collapse handler wired to the 'Show display' button") describes an intent that was never implemented. Decide: either remove `onToggle` from the props type (and the call site) or wire up an inline "Hide" affordance inside the panel that calls `onToggle()`. The latter improves the "scroll back up to find the toggle" UX.
- **Status:** Fixed
- **Resolution:** Removed `onToggle` from `ShowDisplayPanelProps`, the docblock, the `MyGymRow` call site, and all test fixture renders. The `MyGymRow` "Show display" / "Hide display" button already provides toggle affordance above the panel.

#### [FIX] P15-007: `BackfillForm` discovery-error log uses 3 positional args, breaking `[module] Description:` convention

- **File:** src/components/profile/show-display-panel.tsx:175
- **Severity:** High
- **Detail:** `console.error('[display-setup] Backfill discovery failed:', result.error, result.message)` passes three positional args. `.claude/rules/error-handling.md` mandates the shape `console.error('[module-name] Description:', err)` — one description string + one error-like value. Log aggregators (Sentry, Datadog) will stringify positional args #3 separately or drop it depending on transport. Fix: `console.error('[display-setup] Backfill discovery failed: ' + result.error, result.message)` or pass a single structured object. Update the matching test assertion in `show-display-panel.test.tsx`.
- **Status:** Fixed
- **Resolution:** Interpolated error code into the description string so the shape is `[show-display-panel] Backfill discovery failed (CODE):` + `message`. Test assertion updated to match.

#### [FIX] P15-008: `derivePersonalGymName` hardcodes 48-char clamp instead of computing from suffix length

- **File:** src/lib/display-setup.ts:14-17
- **Severity:** High
- **Detail:** `DISPLAY_NAME_MAX_CODE_POINTS = 48` and `NAME_SUFFIX = "'s Training"` (11 chars) are both constants. The header docblock correctly explains `48 + 11 = 59` fits the `gyms.name` SQL constraint of 60. But the arithmetic is implicit: a future refactor that changes `NAME_SUFFIX` to e.g. `"'s Training Floor"` will silently push results past 60 chars and produce a Postgres `check_violation` for users with longer display names. Fix: centralize `GYM_NAME_MAX = 60` in `src/domain/types/gym.ts` (next to `gymSchema.name: z.string().min(1).max(60)`), export it, and compute `DISPLAY_NAME_MAX_CODE_POINTS = GYM_NAME_MAX - NAME_SUFFIX.length`. Removes a three-site coupling (SQL CHECK, Zod schema, display-setup constant).
- **Status:** Fixed
- **Resolution:** Exported `GYM_NAME_MAX = 60` from `src/domain/types/gym.ts`, consumed it in `gymSchema.name.max()`, and derived `DISPLAY_NAME_MAX_CODE_POINTS = GYM_NAME_MAX - NAME_SUFFIX.length` in `display-setup.ts`. Tests updated to reflect the new 49-code-point boundary.

#### [FIX] P15-009: `LegacyNotConfiguredPage` unauthenticated branch emits no breadcrumb log

- **File:** src/components/display/display-dispatcher.tsx:39-40
- **Severity:** Medium
- **Detail:** When `user === null`, the dispatcher renders the legacy "DISPLAY NOT CONFIGURED" page with no `console.info` breadcrumb. Operators investigating "user reports DISPLAY NOT CONFIGURED on a TV they were just using" cannot distinguish "auth state momentarily null during refresh" from "genuinely signed out." Add a one-shot info log (similar to `display/gym/$gymId.tsx:108`).
- **Status:** Fixed
- **Resolution:** Added one-shot `useEffect` + `loggedUnauthRef` emitting `console.info('[display-dispatcher] Unauthenticated user hit /display — showing legacy page')`.

#### [FIX] P15-010: `parseDisplayUrlInput` reasons collapse to one message, no error log on reject

- **File:** src/components/display/display-setup-panel.tsx:57-66 (paste path), :71-79 (QR path)
- **Severity:** Medium
- **Detail:** The parser returns three distinct failure reasons (`'empty' | 'malformed' | 'not-a-uuid'`) but the panel collapses `'malformed'` and `'not-a-uuid'` to the same generic "That does not look like a display URL." message. Worse, neither failure path emits a `console.error`, so a user reporting "I scanned the QR and nothing happened" leaves no production trace. Either (a) give the reasons distinct user copy to earn the third variant, or (b) collapse the `ParseResult` type to `{ reason: 'empty' | 'invalid' }` so the code matches the UX. Regardless, add `console.error('[display-setup] Panel A submit rejected:', result.reason)` to both call sites.
- **Status:** Fixed
- **Resolution:** Collapsed `ParseResult` to `{ reason: 'empty' | 'invalid' }` and added `[display-setup-panel]`-prefixed `console.error` logs to both submit and scan rejection paths. Resolves P15-035 and P15-044 as well.

#### [FIX] P15-011: `clearConfig()` called fire-and-forget in both config stores

- **File:** src/lib/config-store.ts:40-42 (BrowserConfigStore.getConfig corruption path), :62-64 (TauriConfigStore.getConfig corruption path)
- **Severity:** Medium
- **Detail:** On Zod parse failure in `getConfig()`, the code calls `this.clearConfig()` without `await` and without a `.catch`. `clearConfig` is async and, in the Tauri path, makes an IPC call that can fail. The fire-and-forget pattern means cleanup failure during corruption recovery goes unobserved — and the corrupt config stays on disk forever. Fix: `await this.clearConfig().catch((cleanupErr) => console.error('[config-store] Cleanup of corrupt config failed:', cleanupErr))`. Adding `await` also makes the corrupt-then-fresh-write sequence deterministic.
- **Status:** Fixed
- **Resolution:** Awaited `this.clearConfig()` in both stores with a `.catch` that logs `[config-store] Cleanup of corrupt config failed:`.

#### [FIX] P15-012: `display-subscriber.ts` calls `_client.removeChannel()` raw while publisher has `removeChannelSafe`

- **File:** src/lib/display-subscriber.ts:84, :144, :194
- **Severity:** Medium
- **Detail:** `display-publisher.ts` introduced `removeChannelSafe` (escalating warn after 5 consecutive failures) as part of P14-013, but the subscriber still calls `_client.removeChannel(_channel)` raw at three teardown sites. A throw inside `removeChannel` during teardown will propagate and leave the subscriber in an inconsistent state; no log line; no consecutive-failure tracking. The asymmetry between publisher and subscriber is a bug waiting to happen. Fix: extract a shared `removeChannelSafe` helper (ideally in a shared module like `src/lib/realtime-teardown.ts`), or duplicate the wrapper in the subscriber module.
- **Status:** Fixed
- **Resolution:** Duplicated the counted-failure `removeChannelSafe` helper in `display-subscriber.ts` with its own `_removeChannelFailureCount` (counters stay module-local so publisher and subscriber flapping are tracked independently). Replaced all three raw `removeChannel` call sites.

#### [FIX] P15-013: `MyGymRow` member-count fetch error renders `'?'` with no warn log

- **File:** src/components/profile/gym-management-section.tsx:236
- **Severity:** Medium
- **Detail:** `useGymMembers(gym.id)` is called once per row (acknowledged N+1 per the comment at lines 245-247). On error the UI renders `'?'`, but no `console.warn` is emitted, so a transient backend hiccup could render `?` for every row in the list with zero log signal. Add an effect: `useEffect(() => { if (membersError) console.warn('[gym-mgmt] Member count fetch failed for gym', { gymId: gym.id }, membersError) }, [membersError, gym.id])`.
- **Status:** Fixed
- **Resolution:** Added `useEffect` in `MyGymRow` that warns `[gym-mgmt] Member count fetch failed for gym` with gymId and error object on transition.

#### [FIX] P15-014: `writeLastGymChoice` return value discarded in start-workout handlers

- **File:** src/routes/\_authenticated/index.tsx:171, :219
- **Severity:** Medium
- **Detail:** `writeLastGymChoice` was updated in this branch to return `false` when localStorage writes fail (Safari private mode, quota exceeded) — and `gym-picker-storage.ts:73` explicitly documents "Callers can branch on the result to surface a one-off 'could not save preference' toast (P14-014)." The two call sites in `_authenticated/index.tsx` assign the return value and discard it. The user silently loses their sticky-default preference; their next workout reverts to the picker default with no explanation. Fix: branch on the return value, `console.warn('[today-page] Failed to persist last gym choice...')`, and show a light toast.
- **Status:** Fixed
- **Resolution:** Branched on the return value in both `handleStartWorkout` and `handleStartProgrammedSession`, added `[today-page]`-prefixed warn logs, and a sonner toast surfacing the failure to the user.

#### [FIX] P15-015: `ensureChannel` returns null on `!_client` with no defensive log for broadcasting mode

- **File:** src/lib/display-publisher.ts:79-80
- **Severity:** Low
- **Detail:** `ensureChannel` returns `null` silently when `_client === null`. Public entrypoints catch this via `maybeLogSilentDrop` eventually, but the `_publisherMode === 'broadcasting'` branch with `_client === null` is itself a should-never-happen invariant violation (client is cleared on teardown; broadcasting mode should have been cleared first). Add a defensive `console.error` when mode is broadcasting and client is null — this is a logic-bug signal, not a silent-drop signal.
- **Status:** Fixed
- **Resolution:** Added an explicit `console.error('[display-publisher] Invariant violation: broadcasting mode with null client')` inside `ensureChannel` when this case is hit.

#### [FIX] P15-016: No `assertNever` exhaustiveness guards in F019 discriminated-union switches

- **File:** src/components/display/display-dispatcher.tsx:37-49 (DispatcherState.kind switch), src/components/display/display-setup-panel.tsx:60-67 (ParseResult.reason switch)
- **Severity:** Medium
- **Detail:** Both switches are exhaustive today but lack a `default: { const _: never = state; throw new Error('unreachable') }` arm. If a future variant is added to `DispatcherState` or `ParseResult`, the switch will silently render `undefined` or fall through to the last branch instead of failing the build. Add the assertion — one line per switch, one guarantee of compiler enforcement on future additions.
- **Status:** Fixed
- **Resolution:** Added `default: { const _exhaustive: never = state; throw ... }` to `display-dispatcher.tsx` switch. The `display-setup-panel.tsx` ternary was simplified to a two-branch shape by the ParseResult collapse (P15-010), so it is now trivially exhaustive at the TS-level and does not need an assertNever guard.

#### [FIX] P15-017: `dispatcher-state.ts` top-comment precedence table numbers rules 1-8, function body numbers them 1-7

- **File:** src/components/display/dispatcher-state.ts:10-19 (top comment) vs :38-66 (body comments)
- **Severity:** Low
- **Detail:** The module header lists 8 precedence rules (separating "gyms query loading" at #4 from "gyms undefined" at #5). The function body collapses them into one `if (inputs.gymsLoading || inputs.gyms === undefined)` labeled `// 4.`, so "5. Zero-gym" in the body maps to the top's rule #6, and so on. A maintainer cross-referencing the two will be briefly confused. Either renumber the body comments to match (`// 4-5. Gyms still loading or undefined`) or collapse the top list to 7 rules.
- **Status:** Fixed
- **Resolution:** Collapsed the top-comment precedence list to 7 rules (matches the body) and added explicit cross-reference to P15-028 for the stale-data fall-through.

#### [FIX] P15-018: `gym-picker-storage.ts` module header doesn't mention write-side boundary validation

- **File:** src/lib/gym-picker-storage.ts:1-16
- **Severity:** Low
- **Detail:** The module header describes the storage module's purpose but only `readLastGymChoice` (lines 37-48) documents the `isValidChoice` boundary validation. `writeLastGymChoice` silently gained identical validation at lines 76-80 as part of P14-006, with no module-level reference to `.claude/rules/state-management.md` — which explicitly names this file as a canonical example of module-boundary validation. Add one line to the header: "Both read and write validate against `isValidChoice` per .claude/rules/state-management.md — garbage cannot enter or leave the storage boundary." Cross-reference this in `writeLastGymChoice`'s JSDoc (which currently only mentions quota exceeded).
- **Status:** Fixed
- **Resolution:** Added the boundary-validation paragraph to the module header and updated `writeLastGymChoice`'s JSDoc to reference the module header and the state-management rule.

#### [FIX] P15-019: `copy-to-clipboard.ts` header references "four existing call sites" but names three

- **File:** src/lib/copy-to-clipboard.ts:12-15
- **Severity:** Low
- **Detail:** The header comment enumerates three file names (`backend-settings.tsx`, `share-dialog.tsx`, `invite-code-display.tsx`) but says "four existing call sites." Either the count is wrong or a file name is missing. The comment is a known maintenance trap: when a future PR migrates one of these to use the helper, the count drifts. Rewrite as: "Extracted from inline try/catch/log/toast blocks that were duplicated across the codebase (see `backend-settings.tsx`, `share-dialog.tsx`, `invite-code-display.tsx`, `show-display-panel.tsx`). Additional call sites can migrate opportunistically."
- **Status:** Fixed
- **Resolution:** Rewrote the header comment to list four known call sites (including `show-display-panel.tsx`) and explicitly note that the count is intentionally not tracked to avoid drift.

#### [FIX] P15-020: `ensureChannel` JSDoc "Private workout" explanation omits the unconfigured case

- **File:** src/lib/display-publisher.ts:76-84
- **Severity:** Low
- **Detail:** The JSDoc for `ensureChannel` says it returns `null` "if the client is not initialized or there is no active gym (Private workout)". After the boundary validation added in this branch, `_activeGymId === null` is reachable in BOTH `'private'` AND `'unconfigured'` modes — the parenthetical implies Private is the only reason, hiding the refresh/unconfigured case that `maybeLogSilentDrop` exists to catch. Change to "(Private workout OR publisher was never configured — see `maybeLogSilentDrop`)".
- **Status:** Fixed
- **Resolution:** Updated the JSDoc to cover both branches: "Private workout OR publisher was never configured -- in the latter case `maybeLogSilentDrop` in the public entrypoints will log the drop before the caller sees the null".

#### [FIX] P15-025: `display-dispatcher.tsx` defensive `userId ?? ''` pollutes React Query cache key

- **File:** src/components/display/display-dispatcher.tsx:27-28
- **Severity:** Low
- **Detail:** `useGyms` accepts `string | null | undefined` and gates with `enabled: !!userId`. Coalescing to `''` defeats the gating intent (falsy still disables the query) but pollutes the React Query cache key with `['gyms', 'list', '']`. Pass `userId` directly: `const gymsQuery = useGyms(userId)`. Functional no-op; cleaner cache key; removes a misleading defensive pattern.
- **Status:** Fixed
- **Resolution:** Dropped the `?? ''` coalesce; `useGyms(userId)` takes the `string | undefined` directly and gates on `!!userId` as designed.

#### [FIX] P15-026: `display-chooser.tsx` "middle-click" rationale comment is web-only but component runs on Tauri too

- **File:** src/components/display/display-chooser.tsx:13-18
- **Severity:** Low
- **Detail:** The header comment says "Lists every gym the user is a member of as a real `<Link>` so the browser can hover-preview the destination and middle-click opens in a new tab." True for web, but this app ships on Tauri (mobile) where neither hover nor middle-click exist. Reword to: "Lists every gym as a real `<Link>` so the browser (web build) preserves native affordances — hover preview and middle-click-to-new-tab. On Tauri the `<Link>` still renders correctly; these affordances are web-only."
- **Status:** Fixed
- **Resolution:** Rewrote the header comment to scope the hover/middle-click rationale to the web build and note that Tauri still renders `<Link>` correctly even though the affordances are web-only.

#### [FIX] P15-027: `createGym.mutate` onSuccess navigation is racy against cache invalidation

- **File:** src/components/display/display-chooser.tsx:33-43, src/components/display/display-setup-panel.tsx:84-100
- **Severity:** Low
- **Detail:** Both handlers navigate to `/display/gym/$id` in `onSuccess`, but `useCreateGym`'s invalidation happens in `onSettled`, not `onSuccess`. The user lands on the correct URL, but if they ever back-navigate to `/display`, the dispatcher may briefly show 0 gyms (the setup panel) before the cache rehydrates. Fix: either `await queryClient.invalidateQueries({ queryKey: ['gyms'] })` before navigating, or accept the brief flicker. Practical impact is minor (one frame on back-nav) but testable — add an integration test asserting the dispatcher does not flash `'zero'` state after create + back-nav.
- **Status:** Fixed
- **Resolution:** Moved the invalidation from `onSettled` to an awaited `onSuccess` in `useCreateGym`. TanStack Query awaits the hook's `onSuccess` promise before firing the caller's `onSuccess`, so navigation now happens after the cache is refreshed.

#### [FIX] P15-028: `dispatcher-state.ts` treats any `isError` as terminal even when stale `gymsData` is still present

- **File:** src/components/display/dispatcher-state.ts:48
- **Severity:** Low
- **Detail:** TanStack Query exposes `isError: true` even when stale `data` is still cached. The current precedence ladder treats any error as terminal — a transient network blip during a refetch paints the user's whole gym list as "Could not load your gyms" even though it loaded successfully 30 seconds ago. Change the gate to `if (inputs.gymsError && inputs.gyms === undefined)` so refetch failures with stale data fall through to `'many'` and surface the error via a softer banner rather than blowing away the chooser entirely.
- **Status:** Fixed
- **Resolution:** Tightened the error gate to `gymsError && gyms === undefined`. Stale data now falls through to `'many'` / `'single'` / `'zero'`. Added two regression tests (`P15-028: falls through to many()` / `single()`). The dispatcher component logs the underlying error via the useEffect added in P15-003.

#### [FIX] P15-029: `parseDisplayUrlInput` path-segment split accepts unusual URL schemes silently

- **File:** src/lib/display-url.ts:33-72
- **Severity:** Low
- **Detail:** The parser uses `split('/')` rather than `new URL()`. This is intentional (allows bare UUIDs) but means an input like `data:text/html,<script>...</script>/display/gym/<valid-uuid>` parses to `{ ok: true, gymId: '<uuid>' }` because `data:` is dropped along with the leading garbage. Not actively exploitable (only the gym ID survives into router params), but more permissive than the docs imply. Add a regex assertion that the suffix path is exactly `/display/gym/{uuid}` after normalization, rejecting anything before `/display/`. Low priority since the downstream consumer only uses the extracted UUID, but worth documenting the intentional permissiveness if not tightening.
- **Status:** Fixed
- **Resolution:** Documented the intentional permissiveness in the `parseDisplayUrlInput` JSDoc (the downstream consumer only uses the extracted UUID, and the existing `display/gym` segment check already gates exotic schemes). No behavioral change.

#### [FIX] P15-030: `discoverInstance` "no app_url" warn is not surfaced to the setup flow caller

- **File:** src/lib/discovery.ts:108-112, src/routes/setup.tsx
- **Severity:** Low
- **Detail:** The discovery helper logs a warn when the server response omits `app_url` but the caller has no programmatic signal. `setup.tsx` calls `validateAndSave(..., undefined)` and the user goes through onboarding none the wiser. Consider returning an explicit `result.appUrlBackfillNeeded: boolean` (or `result.appUrl: undefined` with a companion flag) so the setup screen can show "Display URLs require manual configuration on this server — you can fix this later in Profile."
- **Status:** Fixed
- **Resolution:** Documented in `discoverInstance`'s JSDoc that `result.ok === true && result.appUrl === undefined` is the programmatic "backfill required later" signal, and added a setup-time toast in `setup.tsx` surfacing the older-server notice to the user.

#### [FIX] P15-031: `useQrScanner.scan()` flattens three distinct failure modes to `null`

- **File:** src/hooks/use-qr-scanner.ts:64-100, src/components/display/display-setup-panel.tsx (consumer)
- **Severity:** Low
- **Detail:** User cancel, permission-denied, plugin load failure, and barcode-scan throw all resolve to `null`. The consumer does `if (content === null) return` — a user who cancelled gets the same UX as a user who denied permission (the latter was sent to OS settings; the former wasn't). A `Result<string, 'cancelled' | 'permission-denied' | 'failed'>` discriminator would let callers branch. Today the permission-denied path silently exits because the caller's toast is gated on `parseDisplayUrlInput` failure, not on the scan result.
- **Status:** Fixed
- **Resolution:** Surfaced the permission-denied branch with an inline toast inside `useQrScanner` so the user understands why the camera didn't open and the OS settings app launched. Kept the `string | null` return shape (a wider API refactor would touch every caller) but made the permission-denied UX distinguishable from cancellation at the user level.

#### [FIX] P15-032: `BackfillForm` uses identical error message for NETWORK_ERROR, NOT_FOUND, and INVALID_RESPONSE

- **File:** src/components/profile/show-display-panel.tsx:172-176
- **Severity:** Low
- **Detail:** `discoverInstance` returns 4 distinct error codes (`INVALID_INPUT`, `NETWORK_ERROR`, `NOT_FOUND`, `INVALID_RESPONSE`) and the F019 spec's point is distinguishing them. The setup page already branches on them. The backfill form should do the same: NETWORK_ERROR → "Could not reach server", INVALID_RESPONSE → "That URL doesn't look like an Ardent Forge instance", NOT_FOUND → "No discovery file at that URL". Today they all collapse to the same generic toast.
- **Status:** Fixed
- **Resolution:** Added a `switch (result.error)` in `BackfillForm.handleSave` with distinct user copy for each code, plus an `assertNever` guard. The NETWORK_ERROR path assertion was added to the existing "Save error path" test.

#### [FIX] P15-033: Promote `'create' | 'join' | 'leave' | 'delete'` literal union to an exported `GymMutationAction` type

- **File:** src/lib/gym-error-messages.ts
- **Severity:** Low
- **Detail:** The action parameter type is repeated inline as a literal union with no exported alias. Promote to `export type GymMutationAction = 'create' | 'join' | 'leave' | 'delete'` so consumers (gym-management-section, display-setup-panel, display-chooser) can type their handlers without duplicating the literal.
- **Status:** Fixed
- **Resolution:** Exported `GymMutationAction = 'create' | 'join' | 'leave' | 'delete'` from `gym-error-messages.ts` and updated the `gymErrorMessage` signature to use it.

#### [FIX] P15-034: `GYM_NAME_MAX = 60` should be a single exported constant

- **File:** src/domain/types/gym.ts:19-26, src/lib/display-setup.ts:11
- **Severity:** Low
- **Detail:** The 60-char name limit lives in three places: the SQL `CHECK` constraint, `gymSchema.name: z.string().min(1).max(60)`, and the `display-setup.ts` docblock. Export `GYM_NAME_MAX = 60` from `gym.ts` and consume it in both places. This is the small piece of P15-008's recommended fix extracted as its own tracked item. Consider fixing both in one commit.
- **Status:** Fixed
- **Resolution:** Exported `GYM_NAME_MAX = 60` from `src/domain/types/gym.ts` and consumed in both `gymSchema.name.max(GYM_NAME_MAX)` and `display-setup.ts`'s derived clamp. Fixed together with P15-008.
- **Relates to:** P15-008

#### [FIX] P15-035: `ParseResult` third variant is unearned — decide to collapse or differentiate UI copy

- **File:** src/lib/display-url.ts:21-23, src/components/display/display-setup-panel.tsx:60-67
- **Severity:** Low
- **Detail:** The parser returns three reasons but two of them (`'malformed'`, `'not-a-uuid'`) collapse to the same UI copy in the consumer. If the UX genuinely cannot distinguish them, collapse the type to `{ reason: 'empty' | 'invalid' }` and simplify. If the distinction is load-bearing, give them distinct user messages. This is the type-side of P15-010's behavioral concern. Decide once and keep the code consistent.
- **Relates to:** P15-010
- **Status:** Fixed
- **Resolution:** Collapsed `ParseResult` to `{ reason: 'empty' | 'invalid' }`. Fixed together with P15-010 and P15-044. All tests updated to match.

#### [FIX] P15-036: `buildDisplayUrl` should return a discriminated `BuildResult` mirroring `ParseResult`

- **File:** src/lib/display-url.ts:88, src/components/profile/show-display-panel.tsx:81
- **Severity:** Low
- **Detail:** `buildDisplayUrl` returns `string | null` (null = no origin available → render backfill form). This is the right shape behaviorally, but the dual nullability of `origin` and `url` is a small smell. Consider `export type BuildResult = { ok: true; url: string } | { ok: false; reason: 'no-origin' }` to mirror `ParseResult` and self-document the contract. The caller's `url === null` check becomes `if (!result.ok)` with room to add new reasons later.
- **Status:** Fixed
- **Resolution:** Exported `BuildResult` from `display-url.ts` and updated `buildDisplayUrl` to return the discriminated union. `ShowDisplayPanel` now branches on `!urlResult.ok`. Tests updated.

#### [FIX] P15-037: `isPgError` guard accepts `{ message: 'foo' }` with no `code` — misleading name

- **File:** src/lib/gym-error-messages.ts:22
- **Severity:** Low
- **Detail:** The type guard returns true for any object with at least one of `code` or `message`. `gymErrorMessage` then falls through to the default branch and returns the generic network message. The guard is named `isPgError` but really means "has an object-ish error shape." Either rename to `hasErrorShape` or tighten to `err is { code: string; message?: string }` (requiring `code`). The rename is safer; the tighten changes runtime behavior for `{ message: 'foo' }` inputs.
- **Status:** Fixed
- **Resolution:** Documented the permissive semantics in the JSDoc ("really means 'has an error-like object shape'") and kept the name for call-site compatibility. The P15-039 default-branch warn log now exposes any drift via operator traces.

#### [FIX] P15-038: Introduce `PG_GYM_CODES = ['23505', '42501', 'PGRST116'] as const` for type-level switch narrowing

- **File:** src/lib/gym-error-messages.ts:38
- **Severity:** Low
- **Detail:** The PG code switch is a `switch` on `string`, which cannot be statically exhaustive — a new code added by Supabase silently falls through to the generic message. Declaring `const PG_GYM_CODES = ['23505', '42501', 'PGRST116'] as const` and `type PgGymCode = (typeof PG_GYM_CODES)[number]` lets the compiler enforce exhaustiveness inside the switch via a narrowed variable. Marginal value at three codes; worth doing if the list grows.
- **Status:** Fixed
- **Resolution:** Added `export const PG_GYM_CODES = ['23505', '42501', 'PGRST116'] as const` alongside the switch, so consumers can discover the known-mapping set without grepping the switch body.

#### [FIX] P15-039: `gymErrorMessage` default branch should `console.warn` when the PG-code fallback fires

- **File:** src/lib/gym-error-messages.ts:38-49
- **Severity:** Low
- **Detail:** The `default` branch returns "Check your connection and try again" for any unknown PG code, including programming errors (new RLS policy bugs, schema drift, unhandled Supabase error types). `.claude/rules/error-handling.md` adapter-boundary policy says safety-net coercions should log at warn level. Add `console.warn('[gym-error-messages] Unmapped PG code for ' + action + ':', code, err)` in the default arm so operators get a signal when new codes start appearing.
- **Status:** Fixed
- **Resolution:** Added a `console.warn('[gym-error-messages] Unmapped PG code for ...)` in the default arm that surfaces action, code, and raw error object.

#### [FIX] P15-040: `dispatcher-state.test.ts` and `display-dispatcher.test.tsx` intentional overlap — document the tradeoff

- **File:** src/components/display/**tests**/dispatcher-state.test.ts, src/components/display/**tests**/display-dispatcher.test.tsx
- **Severity:** Low
- **Detail:** Not a coverage gap — pure state-machine tests and React-wrapper tests both exercise the precedence ladder by design. Doubles maintenance cost when adding new dispatcher states. Add a one-line comment at the top of `display-dispatcher.test.tsx` explaining: "This file tests the wiring of `useAuth`/`useGyms` → `computeDispatcherState` → render. The pure state logic is tested in `dispatcher-state.test.ts` and should not be duplicated here; add render-wiring cases only." Prevents future duplication drift.
- **Status:** Fixed
- **Resolution:** Added a multi-line header comment to `display-dispatcher.test.tsx` explaining the render-wiring-only scope and pointing new maintainers to `dispatcher-state.test.ts` for state-machine assertions.

#### [FIX] P15-041: `e2e/smoke.spec.ts` Scenario 1 lacks an intermediate sign-in-success assertion

- **File:** e2e/smoke.spec.ts (Scenario 1: "Show display panel reveals URL + Copy on web")
- **Severity:** Low
- **Detail:** Scenario 1 creates a user, signs in, then immediately drives the profile form. If sign-in fails due to a CSP regression or auth provider timing, the failure mode is `expect(showButton).toBeVisible()` timing out — which gives no signal about whether the auth flow or the panel rendering broke. Add an intermediate `await expect(page).toHaveURL(/\/profile/)` or `await expect(page.getByText(/Profile/i)).toBeVisible()` between sign-in and the panel assertions so the failure reason is localized.
- **Status:** Fixed
- **Resolution:** Added `await expect(page).toHaveURL(/\/(today|profile|display)/)` between the sign-in and the profile navigation so a CSP or auth provider regression fails fast at a known step instead of timing out on the panel assertion.

#### [FIX] P15-042: `-dispatcher-route.test.tsx` misleading filename — rename to `-dispatcher-integration.test.tsx`

- **File:** src/routes/display/**tests**/-dispatcher-route.test.tsx
- **Severity:** Low
- **Detail:** The file is named `-dispatcher-route.test.tsx` and the comment block says "end-to-end-ish tests for /display dispatcher", but it imports `DisplayDispatcher` directly rather than `routes/display/index.tsx`. The route file is a 5-line shell tested in `-gym-route.test.tsx`. The naming creates a false impression that this is a route-level test when it's really an integration test for the dispatcher component. Rename to `-dispatcher-integration.test.tsx` or add a comment that the route shell is tested in the other file.
- **Status:** Fixed
- **Resolution:** `git mv` renamed the file to `-dispatcher-integration.test.tsx` and the header comment was rewritten to note that the route shell is covered in `-gym-route.test.tsx`.

#### [FIX] P15-043: `display-setup-panel.tsx` `handleScan` non-UUID path should assert input refocus

- **File:** src/components/display/display-setup-panel.tsx:79-83 (production), **tests**/display-setup-panel.test.tsx:215-227 (test)
- **Severity:** Low
- **Detail:** After a non-UUID QR scan, `handleScan` calls `inputRef.current?.focus()` to return focus to the URL input. The existing test asserts the toast and that no navigation occurred, but does not assert focus. If a future refactor removes the focus call, the user is left without an obvious next step. Add to the existing test: `expect(document.activeElement).toBe(screen.getByTestId('display-setup-panel-a-input'))`.
- **Status:** Fixed
- **Resolution:** Added `expect(document.activeElement).toBe(screen.getByTestId('display-setup-panel-a-input'))` assertion inside the existing "non-UUID scan result" test.

#### [FIX] P15-044: `display-setup-panel.tsx` ternary branches share copy without explanation

- **File:** src/components/display/display-setup-panel.tsx:60-68
- **Severity:** Low
- **Detail:** The ternary uses identical copy for `'not-a-uuid'` and `'malformed'`: `result.reason === 'empty' ? 'Enter a display URL.' : result.reason === 'not-a-uuid' ? 'That does not look like a display URL.' : 'That does not look like a display URL.'`. A future maintainer will wonder whether the distinction was abandoned or a bug. Add a one-line comment: `// 'not-a-uuid' and 'malformed' intentionally share copy — users cannot be expected to distinguish them.` Or collapse the branch (see P15-035).
- **Relates to:** P15-035, P15-010
- **Status:** Fixed
- **Resolution:** Collapsed the ternary to a two-branch shape as part of the `ParseResult` simplification (P15-010 / P15-035). No need for a disambiguation comment because the duplicate branch no longer exists.

#### [FIX] P15-045: `[display-setup]` log prefix is shared between two unrelated modules

- **File:** src/components/profile/show-display-panel.tsx (BackfillForm), src/lib/display-setup.ts (derivePersonalGymName)
- **Severity:** Low
- **Detail:** The `[display-setup]` log prefix is used by both the Profile BackfillForm and the `display-setup.ts` name-derivation helper — two unrelated modules. A future operator grep'ing `[display-setup]` will pick up logs from both. Disambiguate: use `[show-display-panel]` or `[display-backfill]` for the Profile component, or document in a shared module header that `[display-setup]` is the shared prefix for F019 D18/D22 code paths.
- **Status:** Fixed
- **Resolution:** Renamed all `show-display-panel.tsx` `console.*` prefixes from `[display-setup]` to `[show-display-panel]` (and updated the copy-to-clipboard logPrefix to match). `display-setup.ts` does not emit logs, so no collision remains.

#### [FIX] P15-046: `$gymId.tsx` uses `z.string().uuid()` while `display-url.ts` comment says it's deprecated in Zod 4

- **File:** src/routes/display/gym/$gymId.tsx:39, src/lib/display-url.ts:15-18
- **Severity:** Low
- **Detail:** The `display-url.ts` header explicitly states: "Uses the Zod 4 top-level `z.uuid()` API rather than the deprecated `z.string().uuid()`." The adjacent `$gymId.tsx` validation still uses `z.string().uuid().safeParse(gymId)`. Either the deprecation claim is incorrect (remove the comment) or one of the two sites should be updated to use the top-level API. The inconsistency confuses anyone reading both files.
- **Status:** Fixed
- **Resolution:** Migrated `$gymId.tsx` to the top-level `z.uuid().safeParse(gymId).success`. Both files now use the same Zod 4 idiom.

#### [FIX] P15-047: `api/discovery.ts` `computeAppUrl` Caddy-specific comment will silently rot

- **File:** api/discovery.ts:11-16
- **Severity:** Low
- **Detail:** The comment says `x-forwarded-proto` is "also forwarded" by Caddy in the self-hosted docker-compose. This is a configuration assertion that will rot if the docker-compose Caddyfile changes. The fallback to `'https'` is safe, but the comment implies Caddy is reliably forwarding, which the API route cannot actually verify. Soften to: "Caddy in the self-hosted docker-compose template forwards this by default; self-hosters who swap in a different reverse proxy must verify the header is set." Or drop the Caddy-specific reference entirely since the fallback handles it.
- **Status:** Fixed
- **Resolution:** Rewrote the comment to drop the Caddy-specific name, reference generic "reverse proxy (Caddy, nginx, Traefik, etc.)" responsibility, and explain the http-only failure mode when the header is missing.

#### [FIX] P15-048: `gym-management-section.tsx` pagination TODO lacks backlog reference

- **File:** src/components/profile/gym-management-section.tsx:314-316
- **Severity:** Low
- **Detail:** The TODO reads `// TODO: paginate when gyms.length > ~50 (Spec.md S8, RD-19). The underlying query is index-friendly...` — acceptable (cross-references Spec.md), but a new `Context/Backlog/gym-management-pagination.md` item was added in this same branch and the TODO doesn't point at it. Change to: `// TODO(backlog): paginate when gyms.length > ~50. See Context/Backlog/gym-management-pagination.md and Spec.md S8/RD-19.`
- **Status:** Fixed
- **Resolution:** Updated the TODO to `TODO(backlog):` with an explicit reference to `Context/Backlog/gym-management-pagination.md` alongside the Spec.md pointer.

### Missing Tasks

#### [TASK] P15-021: SQL trigger test Section 2 does not actually exercise the trigger it claims to test

- **File:** supabase/tests/018_gym_owner_enroll.sql Section 2 ("Trigger is idempotent against duplicate inserts")
- **Severity:** Medium
- **Detail:** Section 2 inserts a gym (fires trigger, creates membership row #1), then attempts a hand-crafted duplicate `gym_members` insert with `on conflict do nothing`. The conflict is resolved by the standalone `on conflict` clause in the second statement, NOT by the trigger code. The test would still pass if the trigger's own `on conflict do nothing` were removed, so it provides no guarantee of the trigger's idempotency. To actually test trigger idempotency, the test must exercise a path where the trigger fires against pre-existing membership (e.g., `delete trigger; insert gyms; insert gym_members; create trigger; update gyms`). At minimum, add a comment acknowledging that Section 2 tests the conflict clause rather than the trigger. Also: the file is named `018_*` and headed "F018 P14-018" but the migration (`20260407000004_enroll_gym_creator.sql`) is part of F019 scope — rename or cross-reference for traceability.
- **Relates to:** F019 migration `20260407000004_enroll_gym_creator.sql`
- **Status:** Task created
- **Resolution:** Added as S018-T in Steps.md Wave 8.

#### [TASK] P15-022: `ShowDisplayPanel` Tauri `getConfig()` rejection path has no test

- **File:** src/components/profile/show-display-panel.tsx:53-64 (production code), src/components/profile/**tests**/show-display-panel.test.tsx (test file)
- **Severity:** Medium
- **Detail:** The component has a `try { ... } catch (err) { console.error(...); if (!cancelled) setOrigin(null) }` clause that runs when `getConfigStore().getConfig()` rejects in Tauri mode. Test coverage stubs `mockGetConfig.mockResolvedValue(...)` with success cases only. A regression (e.g., SQLite store throwing on corrupt file) would silently transition the panel into the backfill form with no assertion that this is the intended behavior. Add an `it('falls through to backfill form when getConfig() rejects', ...)` test that calls `mockGetConfig.mockRejectedValue(new Error('store corrupted'))` and asserts the backfill panel renders, with the expected `[display-setup]` log.
- **Relates to:** Spec.md TA2
- **Status:** Task created
- **Resolution:** Added as S019-T in Steps.md Wave 8.

#### [TASK] P15-023: `useQrScanner.cancel()` standalone export path has no test

- **File:** src/hooks/use-qr-scanner.ts:100-112 (exported cancel function), src/routes/setup.tsx:235 (consumer), src/hooks/**tests**/use-qr-scanner.test.tsx (test file)
- **Severity:** Medium
- **Detail:** `useQrScanner` exports `cancel: () => Promise<void>` as part of its public result. `setup.tsx:235` invokes `qrScanner?.cancel()` from the in-progress scan overlay's Cancel button. Existing tests verify the auto-cancel inside `scan()` via `expect(cancelMock).toHaveBeenCalled()`, but never invoke `result.current.cancel()` directly — the `cancelRef.current` null-guard and the `Failed to cancel scan:` error path are uncovered. A regression in setup.tsx's Cancel button (cancel-without-active-scan path throwing) would only be caught at integration test time. Add `it('cancel() is a noop when no scan is in progress', ...)` and `it('cancel() resets scanning state and clears cancelRef', ...)`.
- **Relates to:** S007-T in Context/Features/019-Display-Setup-UX/Steps.md
- **Status:** Task created
- **Resolution:** Added as S020-T in Steps.md Wave 8.

#### [TASK] P15-049: `display-publisher-hello.test.ts` uses brittle "force channel creation by publishing" pattern

- **File:** src/lib/**tests**/display-publisher-hello.test.ts
- **Severity:** Low
- **Detail:** The test calls `publishDisplaySnapshot(SNAPSHOT)` solely to trigger lazy channel creation, then fires a hello event on the captured channel mock. If the publisher's lazy-init pattern changes (e.g., subscribes to the channel during `init` rather than first publish), this test will silently start passing for the wrong reason. Either extract an explicit test-only `ensureChannel()` or `subscribe()` hook, or add a comment documenting the dependency so future refactors catch the implicit coupling.
- **Status:** Task created
- **Resolution:** Added as S021-T in Steps.md Wave 8.

#### [TASK] P15-050: Missing test for `discoverInstance` rejecting `javascript:` URLs

- **File:** src/lib/**tests**/discovery.test.ts
- **Severity:** Low
- **Detail:** `display-url.test.ts:117-122` tests that `parseDisplayUrlInput('javascript:alert(1)')` returns `not-a-uuid`, but `discovery.ts:43-49` has a parallel protocol guard at the discovery layer. The discovery test only covers `file://` and `ftp://` rejection. A `javascript:` URL would take a different path (new URL() processes them differently than http/https). Add `it('returns INVALID_INPUT for a javascript: URL', ...)` to the discovery test's rejection cases, parallel to the existing `file://` and `ftp://` cases. Defense-in-depth for the security boundary at the setup discovery flow.
- **Status:** Task created
- **Resolution:** Added as S022-T in Steps.md Wave 8.

#### [TASK] P15-051: `display-idle-snapshot` permanent-failure classification has no external alerting path

- **File:** supabase/functions/display-idle-snapshot/index.ts:163-189
- **Severity:** Low
- **Detail:** When all failures share an error code (indicating a systemic regression like a broken RLS policy), the function logs `[display-idle-snapshot] All N failures share code: 42501` and returns 200 to stop cron retries. Correct behavior, but the systemic-failure log is a `console.error` that requires somebody to be watching function logs. Consider returning a structured `permanent_failure: true` field that an external alerting hook can scrape, or wire a Sentry breadcrumb when the codes-set is non-empty. Track as a follow-on observability task.
- **Status:** Task created
- **Resolution:** Added as S023 in Steps.md Wave 8.

#### [TASK] P15-052: Add round-trip property test for `parseDisplayUrlInput` ∘ `buildDisplayUrl`

- **File:** src/lib/**tests**/display-url.test.ts
- **Severity:** Low
- **Detail:** Current tests are example-based. A property test that asserts `parseDisplayUrlInput(buildDisplayUrl(uuid, origin)!).gymId === uuid` for a range of random UUIDs and origins would catch any future divergence between the two functions (e.g., if `buildDisplayUrl` ever encodes or normalizes a character that the parser doesn't round-trip). Use fast-check or a simple `for` loop with a fixed UUID set.
- **Status:** Task created
- **Resolution:** Added as S024-T in Steps.md Wave 8.

#### [TASK] P15-053: Introduce `makeGym` factory that routes test fixtures through `gymSchema.parse`

- **File:** src/components/display/**tests**/dispatcher-state.test.ts:10-18 (and other fixture construction sites)
- **Severity:** Low
- **Detail:** Test fixtures construct `Gym` literals directly via object spread, creating a parallel "trusted shape" that diverges from the production path through `gymSchema.parse`. A fixture that passes a string where a UUID is expected will pass in tests but fail at runtime. Add `src/test/fixtures/gym.ts` exporting `makeGym(overrides: Partial<Gym> = {}): Gym` that runs the result through `gymSchema.parse` so test inputs are validated identically to production data. Migrate existing fixtures opportunistically.
- **Status:** Task created
- **Resolution:** Added as S025-T in Steps.md Wave 8.

#### [TASK] P15-054: `show-display-panel.test.tsx` missing Tauri-mode dev-origin warning coverage

- **File:** src/components/profile/**tests**/show-display-panel.test.tsx
- **Severity:** Low
- **Detail:** The dev-origin warning test at lines 107-114 only covers web mode (mutating `window.location.origin` to `http://localhost:5173`). The Tauri-mode equivalent — where `config.appUrl` resolves to a loopback URL after a local `vercel dev` or docker-compose setup — is the more interesting case for QA and is not covered. Add `it('renders dev-origin warning when Tauri appUrl is loopback', ...)` to the "Tauri with appUrl" describe block, mocking `mockGetConfig.mockResolvedValue({ ..., appUrl: 'http://localhost:5173' })`.
- **Status:** Task created
- **Resolution:** Added as S026-T in Steps.md Wave 8.

### Architectural Concerns

#### [ADR] P15-024: ADR-013 (`GymId` brand) was authored for F019 but deferred silently

- **File:** Context/Decisions/ADR-013-type-safe-gym-id-propagation.md, src/components/display/dispatcher-state.ts:26, src/lib/display-url.ts:22, src/components/display/display-setup-panel.tsx (navigateToGym), src/components/profile/show-display-panel.tsx (BackfillFormProps.gymId), src/domain/types/gym.ts:19-26
- **Severity:** High
- **Detail:** ADR-013 was authored in this same branch and explicitly says: "Migration strategy: bottom-up, in a single PR (F019)." The ADR's rationale (P14-001 silent-downgrade bug class, the publisher's parallel state-machine problem) remains fully valid. F019 was supposed to execute the migration. Commit `2cb69e1` message reads "Zero new domain types." The result: F019 added six new raw-string consumers of gym IDs — `DispatcherState.gymId: string`, `ParseResult.gymId: string`, local `navigateToGym(gymId: string)` helpers in display components, `BackfillFormProps.gymId: string`, plus every new test fixture constructing `Gym` literals by object spread rather than `gymSchema.parse`. Every one of these is a future migration site. The `entityId = z.string().min(1)` at `units.ts:8` still accepts `'private'` as a "valid" ID — the exact bug class ADR-013 was written to prevent. Decision required: (a) land the brand inside this PR before merge, (b) author ADR-014 superseding ADR-013 with the chosen scope reduction and rationale, or (c) add a high-priority backlog item tracking the deferred migration with explicit scope. The current state ("ADR says this will happen in F019; F019 says zero new types; no record of why") is strictly worse than any of the three alternatives because it leaves future readers with contradictory signals.
- **Relates to:** ADR-013, Spec.md TA9/TA10/TA11 (parser), Spec.md RD-14
- **Status:** ADR created
- **Resolution:** ADR-014 (`Context/Decisions/ADR-014-defer-gym-and-user-id-brands.md`) records the deferral decision and the "GymId and UserId migrate together" scope rule. ADR-013 remains `Proposed` and will flip to `Accepted` when the follow-on PR lands. Backlog item `Context/Backlog/gym-user-id-brand-migration.md` names the six F019 raw-string consumers plus the `entityId` tightening work.

#### [ADR] P15-055: `DispatcherInputs.user.id` structural `{ id: string }` shape leaks raw strings into query hooks

- **File:** src/components/display/dispatcher-state.ts:29-36, src/components/display/display-dispatcher.tsx, src/components/display/display-setup-panel.tsx (userId prop), src/components/display/display-chooser.tsx (userId prop)
- **Severity:** Medium
- **Detail:** `DispatcherInputs.user: { id: string } | null` is structural for testability, but the `id: string` eventually becomes `userId: string` props on `DisplaySetupPanel` and `DisplayChooser`, which then pass it through to query hooks and `createGym`. This is the _user-id_ half of the same type-safety gap ADR-013 was written for the gym-id half: a brand (`UserId`) would prevent `userId = 'system'` or `userId = ''` from ever reaching a query hook. Fold into the ADR-013 decision: the brand work should cover both `GymId` and `UserId` together, or the deferral decision should note that both are deferred. Do not ship `GymId` without `UserId` — the two migrate together or neither does.
- **Relates to:** P15-024, ADR-013
- **Status:** ADR created
- **Resolution:** ADR-014 explicitly bundles `UserId` into the brand migration per this finding's recommendation ("the two migrate together or neither does"). Resolved together with P15-024.

### Convention Gaps

#### [RULE] P15-056: New `border-t border-surface-steel` divider lines violate Iron & Ember "no dividers" rule

- **Files:** src/components/display/display-chooser.tsx:67, src/components/display/display-setup-panel.tsx:159, :162, src/routes/setup.tsx:351-353
- **Severity:** Medium
- **Detail:** CLAUDE.md design system states: "no divider lines (tonal layering)" as one of the few non-negotiable Iron & Ember constraints. F019 introduces four new instances of `border-t border-surface-steel` dividers: the chooser's "or start a personal display" separator, the setup panel's "or" divider (two `flex-1 border-t` spans), and the setup route's manual-config section divider. Tonal contrast (e.g., `bg-surface-pit/40` wrapper) or a bare "or" label without flanking lines is the documented idiom. There is visible precedent for this violation already in `gym-management-section.tsx:58` and `_authenticated/index.tsx:343`, suggesting the rule is applied selectively in practice — which is exactly why a linter/rule is needed to make the expectation enforceable. **Suggested rule:** add `design-system-dividers.md` (or append to `.claude/rules/layout-conventions.md`) documenting that `border-t`, `border-b`, `border-l`, `border-r` with `border-surface-*` colors are prohibited; flag them in code review; consider an ESLint custom rule if the hook can be extended.
- **Suggested rule:** .claude/rules/layout-conventions.md or new .claude/rules/design-system-dividers.md
- **Status:** Rule updated
- **Resolution:** Added a "No Divider Lines (Iron & Ember)" section to `.claude/rules/layout-conventions.md` documenting the prohibition, the tonal-depth alternative, a good/bad code example, and the grandfathering exception for pre-existing violations. Also migrated the four F019 violations (display-chooser, display-setup-panel x2, setup.tsx) to tonal surfaces or bare "or" labels as worked examples.

## Resolution Checklist

- [x] All [FIX] findings resolved (44 items: P15-001 through P15-020, P15-025 through P15-048)
- [x] All [TASK] findings added to Steps.md (9 items: P15-021, P15-022, P15-023, P15-049, P15-050, P15-051, P15-052, P15-053, P15-054)
- [x] All [ADR] findings have ADRs created or dismissed (2 items: P15-024, P15-055)
- [x] All [RULE] findings applied or dismissed (1 item: P15-056)
- [x] Review verified by review-verify agent

## Resolution Summary

**Resolved at:** 2026-04-07
**Session:** `/review-resolve` single-pass execution in fresh session after F019 PR review capture

| Category  | Total  | Resolved |
| --------- | ------ | -------- |
| [FIX]     | 44     | 44       |
| [TASK]    | 9      | 9        |
| [ADR]     | 2      | 2        |
| [RULE]    | 1      | 1        |
| **Total** | **56** | **56**   |

### Notable bundling

- P15-024 and P15-055 resolved with a single ADR (ADR-014) plus a backlog
  item (`Context/Backlog/gym-user-id-brand-migration.md`), per the review's
  guidance that `GymId` and `UserId` must migrate together or neither does.
- P15-008 and P15-034 resolved together in one commit — the `GYM_NAME_MAX`
  constant and the derived `derivePersonalGymName` clamp are the same fix
  at different levels.
- P15-010, P15-035, and P15-044 resolved together by collapsing
  `ParseResult` from three reasons to two (`empty | invalid`), matching
  the UI copy to the type.
- P15-003, P15-009, P15-016, P15-025, and P15-028 resolved in a single
  `display-dispatcher.tsx` / `dispatcher-state.ts` edit because all five
  findings were co-located in the dispatcher subsystem.
- P15-033, P15-037, P15-038, and P15-039 resolved in a single
  `gym-error-messages.ts` edit (type promotion, guard JSDoc, code const
  tuple, default-branch warn log).

### Files touched

**Source edits:** `src/components/display/display-dispatcher.tsx`,
`dispatcher-state.ts`, `display-chooser.tsx`, `display-setup-panel.tsx`,
`src/components/profile/gym-management-section.tsx`, `show-display-panel.tsx`,
`src/lib/config-store.ts`, `copy-to-clipboard.ts`, `discovery.ts`,
`display-publisher.ts`, `display-setup.ts`, `display-subscriber.ts`,
`display-url.ts`, `gym-error-messages.ts`, `gym-picker-storage.ts`,
`src/hooks/use-gyms.ts`, `use-qr-scanner.ts`, `src/routes/_authenticated/index.tsx`,
`src/routes/display/gym/$gymId.tsx`, `src/routes/setup.tsx`,
`src/domain/types/gym.ts`, `api/discovery.ts`.

**Test edits:** `show-display-panel.test.tsx`, `display-setup-panel.test.tsx`,
`display-url.test.ts`, `display-setup.test.ts`, `dispatcher-state.test.ts`,
`display-dispatcher.test.tsx`, `e2e/smoke.spec.ts`.

**Test rename:** `-dispatcher-route.test.tsx` → `-dispatcher-integration.test.tsx`.

**New files:** `Context/Decisions/ADR-014-defer-gym-and-user-id-brands.md`,
`Context/Backlog/gym-user-id-brand-migration.md`.

**Rule updates:** `.claude/rules/layout-conventions.md` (added "No Divider
Lines" section).

**Steps.md:** added Wave 8 with nine follow-up tasks (S018-T through S026-T).
