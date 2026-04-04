# Implementation Steps: Idle Mode + Edge Function

**Spec:** Context/Features/009-idle-mode/Spec.md
**Tech:** Context/Features/009-idle-mode/Tech.md

## Progress
- **Status:** Complete
- **Current task:** --
- **Last milestone:** Feature complete (all 17 assertions verified)

---

## Team Orchestration

### Team Members

- **builder-frontend**
  - Role: React/TypeScript -- domain types, display route, idle view components, hooks, transition wrapper
  - Agent Type: frontend-specialist
  - Resume: false

- **builder-backend**
  - Role: Supabase Edge Function -- SQL query, Realtime HTTP broadcast, cron config
  - Agent Type: backend-engineer
  - Resume: false

- **validator**
  - Role: Quality validation -- read-only assertion verification against Spec testable assertions
  - Agent Type: quality-engineer
  - Resume: false

---

## Tasks

### Phase 1: Domain Types + Route Shell (parallel workstreams)

> S001 and S004 are independent and run in parallel. S002 and S003 depend on S001.

- [ ] S001: Extend `DisplayEventType` and add `IdleSnapshot` Zod schema
  - **Assigned:** builder-frontend
  - **Depends:** none
  - **Parallel:** true
  - **Details:** In `src/domain/types/display-snapshot.ts`, add `'idle_snapshot'` to the `displayEventTypeSchema` enum. Define `idleSnapshotSchema` with fields: `server_time` (isoDateTime), `scheduled_sessions` (array of `{ display_name, session_name, session_type, day_label }`), `next_session` (`{ display_name, session_name } | null`). Export `IdleSnapshot` inferred type. Update `src/domain/types/index.ts` to re-export `IdleSnapshot` and `idleSnapshotSchema`.

- [ ] S001-T: Test `IdleSnapshot` schema validation
  - **Assigned:** builder-frontend
  - **Depends:** S001
  - **Parallel:** false
  - **Details:** Add to `src/domain/types/__tests__/display-snapshot.test.ts`. Scenarios: valid payload with sessions and next_session parses correctly; valid payload with next_session null parses correctly; missing server_time fails; scheduled_sessions with missing required field fails; idle_snapshot added to DisplayEventType enum.

- [ ] S002: Create `/display` route shell with search param validation
  - **Assigned:** builder-frontend
  - **Depends:** S001
  - **Parallel:** false
  - **Details:** Create `src/routes/display.tsx` as a top-level file-based route (not under `_authenticated/`). Use `createFileRoute('/display')` with `validateSearch: z.object({ clock: z.enum(['12h', '24h']).optional().default('24h') })`. Component renders a full-viewport `div` with `bg-[#131313] min-h-screen` -- no sidebar, no nav, no header. Modify `src/routes/__root.tsx` `beforeLoad` to add `|| location.pathname.startsWith('/display')` to the config-check bypass (matching the existing `/s/` pattern).

- [ ] S003: Create `useDisplayMode` hook
  - **Assigned:** builder-frontend
  - **Depends:** S001
  - **Parallel:** false
  - **Details:** Create `src/components/display/use-display-mode.ts`. Accept `sessionMap: Map<string, DisplaySnapshot>`, `focusedUserId: string | null`, and `idleSnapshot: IdleSnapshot | null` as inputs. Return `{ mode: 'idle' | 'board' | 'focused', previousMode: 'idle' | 'board' | 'focused' | null, focusedSnapshot: DisplaySnapshot | null }`. Mode derivation: map empty = `'idle'`; map has entries + no focusedUserId = `'board'`; focusedUserId set + user in map = `'focused'`; focusedUserId set + user NOT in map = `'board'` (focus cleared). Track previousMode via `useRef` for transition direction.

- [ ] S003-T: Test `useDisplayMode` hook
  - **Assigned:** builder-frontend
  - **Depends:** S003
  - **Parallel:** false
  - **Details:** Create `src/components/display/__tests__/use-display-mode.test.ts`. Use `renderHook`. Scenarios: empty map returns idle; map with one entry returns board; map with entry + matching focusedUserId returns focused; map with entry + non-matching focusedUserId returns board (focus auto-cleared); map empties after entries returns idle; previousMode updates correctly across transitions.

- [ ] S004: Create Edge Function and cron config
  - **Assigned:** builder-backend
  - **Depends:** none
  - **Parallel:** true
  - **Details:** Create `supabase/functions/display-idle-snapshot/index.ts`. Follow the exact pattern of existing chat-media functions: Deno runtime, ESM from `esm.sh`, `Deno.serve(handler)`, CORS boilerplate (OPTIONS preflight returns `{ headers: corsHeaders }`). Use `createClient(url, serviceRoleKey)` -- no user auth header. Execute the SQL JOIN query (see Tech.md D4) to get today's remaining scheduled sessions for all `display_visible = true` users. Build `IdleSnapshot` payload: `server_time` from `new Date().toISOString()`, `scheduled_sessions` array (max 3 items, sliced after query), `next_session` as first item or null. Broadcast via `fetch(POST /realtime/v1/api/broadcast)` with service_role Bearer token and topic `"realtime:display"`. Return `{ published: true, session_count: N }` on success. Modify `supabase/config.toml` to add `[functions.display-idle-snapshot]` with `verify_jwt = false` and `[functions.display-idle-snapshot.cron]` with `schedule = "*/1 * * * *"`.

- [ ] S004-T: Test Edge Function query logic and payload shape
  - **Assigned:** builder-backend
  - **Depends:** S004
  - **Parallel:** false
  - **Details:** Manual test via `supabase functions serve display-idle-snapshot` + curl. Scenarios: function responds 200 with `{ published: true }`; payload contains `server_time` ISO timestamp; `scheduled_sessions` is an array (empty if no sessions today); `scheduled_sessions` capped at 3 items; `next_session` is null when array is empty; `next_session` contains first session when array is non-empty. Verify service_role key is used (A-012): confirm `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` in source, not ANON key.

🏁 **MILESTONE: Phase 1 complete** -- types defined, route shell exists, Edge Function deployable
- Verify A-009: invoke function manually, confirm broadcast event appears on `display` channel
- Verify A-010: inspect payload structure against `IdleSnapshot` schema
- Verify A-012: confirm service_role key usage in Edge Function source

**Contracts:**
- `src/domain/types/display-snapshot.ts` -- `IdleSnapshot` Zod schema and type, updated `DisplayEventType` enum
- `src/domain/types/index.ts` -- `IdleSnapshot` and `idleSnapshotSchema` exports
- `supabase/functions/display-idle-snapshot/index.ts` -- deployed Edge Function broadcasting `idle_snapshot` events

---

### Phase 2: Idle View Components (parallel)

> S005, S006, and S007 are independent of each other and run in parallel. All depend on S001 (types).

- [ ] S005: Create `ClockDisplay` component
  - **Assigned:** builder-frontend
  - **Depends:** S001
  - **Parallel:** true
  - **Details:** Create `src/components/display/clock-display.tsx`. Props: `format: '12h' | '24h'`, `serverTimeCorrection?: string` (ISO timestamp, optional). Maintain internal `Date` state updated via `setInterval(..., 1000)`. On `serverTimeCorrection` prop change (when new `idle_snapshot` arrives), reset internal clock state to `new Date(serverTimeCorrection)` -- this is the drift correction (Tech.md D5). Format output: 24h = `HH:MM:SS` (using `toLocaleTimeString('en-GB')`), 12h = `H:MM:SS AM/PM`. Styles: `font-display text-[8rem] leading-none text-foreground tracking-tight` on a 1080p viewport. Cleanup `setInterval` on unmount to satisfy A-014. No border, no background -- pure text.

- [ ] S005-T: Test `ClockDisplay` component
  - **Assigned:** builder-frontend
  - **Depends:** S005
  - **Parallel:** false
  - **Details:** Create `src/components/display/__tests__/clock-display.test.tsx`. Use Vitest fake timers (`vi.useFakeTimers`). Scenarios: renders initial time; advances by 1 second after `vi.advanceTimersByTime(1000)`; 24h format renders without AM/PM; 12h format renders with AM/PM; serverTimeCorrection prop change resets displayed time to provided value; setInterval is cleared on unmount (use `vi.spyOn(global, 'clearInterval')`).

- [ ] S006: Create `IdleView` component
  - **Assigned:** builder-frontend
  - **Depends:** S001
  - **Parallel:** true
  - **Details:** Create `src/components/display/idle-view.tsx`. Props: `idleSnapshot: IdleSnapshot | null`, `clockFormat: '12h' | '24h'`. Layout: full-viewport flex column with `bg-[#131313]`. Upper half: centered `ClockDisplay` + date line (`new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })` in Inter body-large text-secondary). Lower section (only when `idleSnapshot?.scheduled_sessions.length`): "TODAY'S SESSIONS" header (Space Grotesk label-large ALL-CAPS text-secondary), session rows on `bg-[#201F1F]` cards (display_name in Space Grotesk, session_type + day_label in Inter label-medium ALL-CAPS text-secondary), max 3 rows. "NEXT UP" badge (only when `idleSnapshot?.next_session`): `bg-[#353534]` with `text-[#FFB59C]` (ember), zero border-radius, "NEXT UP: [session_name]" in Space Grotesk label-large ALL-CAPS. Footer: `bg-[#0E0E0E]` fixed bottom, connection status (passed as prop `connectionStatus: 'connected' | 'reconnecting'`). Minimum font-size enforced via `text-[1.25rem]` baseline on all Inter text.

- [ ] S006-T: Test `IdleView` component
  - **Assigned:** builder-frontend
  - **Depends:** S006
  - **Parallel:** false
  - **Details:** Create `src/components/display/__tests__/idle-view.test.tsx`. Scenarios: renders clock section (A-001, A-003); renders date line below clock in text-secondary; session list renders when `idleSnapshot` has sessions (A-004); session list hidden when `idleSnapshot` is null (schedule unavailable); "NEXT UP" badge renders with ember styling when `next_session` present (A-005); "NEXT UP" badge absent when `next_session` is null (A-006); sessions capped at 3 rows when 4+ provided; footer renders with connection status.

- [ ] S007: Create `DisplayModeTransition` wrapper
  - **Assigned:** builder-frontend
  - **Depends:** S003
  - **Parallel:** true
  - **Details:** Create `src/components/display/display-mode-transition.tsx`. Props: `mode: 'idle' | 'board' | 'focused'`, `previousMode: 'idle' | 'board' | 'focused' | null`, `children: React.ReactNode`. Apply `tw-animate-css` classes conditionally: idle↔board transitions use `key={mode}` on the content div + `animate-in fade-in-0 duration-300` / `animate-out fade-out-0 duration-300`; board↔focused use `animate-in zoom-in-95 fade-in-0 duration-[400ms]` / `animate-out zoom-out-95 fade-out-0 duration-[400ms]`. Use `AnimatePresence`-style key changes to trigger enter animations: changing `key` on the wrapper div forces React to unmount/remount and replay `animate-in` classes. Validate transition durations satisfy A-007 (300ms idle↔board) and A-017 (400ms board↔focused).

🏁 **MILESTONE: Phase 2 complete** -- all idle view components built and unit tested
- Verify A-001: ClockDisplay unit test passes (ticks every second)
- Verify A-002: ClockDisplay renders at 8rem+ (visual inspection / Storybook)
- Verify A-003: date line renders below clock in correct style
- Verify A-004, A-005, A-006: IdleView snapshot tests pass
- Verify A-015, A-016: visual inspection of Iron & Ember tokens and minimum font sizes

**Contracts:**
- `src/components/display/clock-display.tsx` -- ClockDisplay component, props interface
- `src/components/display/idle-view.tsx` -- IdleView component, props interface
- `src/components/display/display-mode-transition.tsx` -- DisplayModeTransition wrapper, props interface
- `src/components/display/use-display-mode.ts` -- useDisplayMode hook, return shape

---

### Phase 3: Subscriber Hook + Route Wiring

- [ ] S008: Create `useIdleSnapshot` hook
  - **Assigned:** builder-frontend
  - **Depends:** S001, S004
  - **Parallel:** false
  - **Details:** Create `src/components/display/use-idle-snapshot.ts`. Subscribe to the `display` Broadcast channel (same channel name as the existing publisher). Filter incoming events for `event === 'idle_snapshot'`. Validate payload with `idleSnapshotSchema.safeParse()` -- discard invalid payloads silently. Store the most recent valid `IdleSnapshot` in local state and return it. On unmount, unsubscribe from channel. Handle the case where the Supabase client is not initialized (return null without throwing). This hook coexists with Step 28's subscriber hook on the same channel -- verify that two independent `client.channel('display')` calls do not duplicate events (see Tech.md unknown). If duplication is observed during testing, refactor to share the subscription via a module-level singleton (same pattern as `display-publisher.ts`).

- [ ] S009: Wire display route -- compose components, drive mode transitions, handle reconnection
  - **Assigned:** builder-frontend
  - **Depends:** S002, S003, S005, S006, S007, S008
  - **Parallel:** false
  - **Details:** Implement the full `/display` route in `src/routes/display.tsx`. Compose: `useIdleSnapshot` for idle data; `useDisplayMode` (with sessionMap from Step 28's subscriber, focusedUserId from focus events, idleSnapshot); `DisplayModeTransition` wrapping the active view. Render: when mode is `'idle'` render `<IdleView idleSnapshot={...} clockFormat={...} connectionStatus={...} />`; when `'board'` render `<BoardView>` (Step 28 component or placeholder); when `'focused'` render `<FocusedView>` (Step 28 component or placeholder). Reconnection: subscribe to channel `status` events; when `CLOSED` or `TIMED_OUT`, show "Reconnecting..." in footer; on reconnect, re-subscribe and publish `display_hello` per Tech.md D6 (Step 28 behavior). Pass `clockFormat` from `Route.useSearch().clock`. Ensure all subscriptions and intervals are cleaned up in `useEffect` return functions (A-013, A-014).

- [ ] S009-T: Integration smoke test for display route
  - **Assigned:** builder-frontend
  - **Depends:** S009
  - **Parallel:** false
  - **Details:** Manual integration test. Open `http://localhost:5173/display` with no active workouts -- verify idle view with clock renders. Open `http://localhost:5173/display?clock=12h` -- verify 12h format. Simulate an `idle_snapshot` event via Supabase Realtime dashboard -- verify session list appears. Start a workout in another tab -- verify transition to board view. End workout -- verify transition back to idle. Verify no console errors after 5 mode transitions (A-014 quick check).

- [ ] S009-D: Update self-hosting docs with display route and Edge Function
  - **Assigned:** builder-backend
  - **Depends:** S004, S009
  - **Parallel:** false
  - **Details:** Add a section to `docs/self-hosting.md` under a "Remote Display" heading. Cover: (1) the `/display` URL is public and requires no login; (2) the `display-idle-snapshot` Edge Function must be deployed for schedule data to appear; (3) cron configuration in `supabase/config.toml` (already included in the repo); (4) how to open the display on a TV browser (navigate to `https://<your-domain>/display`); (5) the `?clock=12h` URL param for 12-hour format.

🏁 **MILESTONE: Phase 3 complete** -- full display route wired end-to-end
- Verify A-007: idle→board transition animates in 300ms
- Verify A-008: board→idle transition animates in 300ms
- Verify A-017: board↔focused transitions animate at 400ms
- Verify A-011: Edge Function filters completed sessions (manual DB seed test)
- Verify A-013/A-014: no stale timers after multiple transitions

---

### Phase 4: Validation

- [ ] S010: Full assertion validation
  - **Assigned:** validator
  - **Depends:** S001-T, S003-T, S004-T, S005-T, S006-T, S009-T
  - **Parallel:** false
  - **Details:** Read-only inspection. Verify all 17 testable assertions from Spec.md. Check: (A-001) ClockDisplay test passes; (A-002) 8rem font-size class present; (A-003) date line class includes text-secondary and Inter; (A-004) IdleView renders session list; (A-005/A-006) next_session badge conditional logic correct; (A-007/A-008) DisplayModeTransition uses duration-300 for idle↔board; (A-009) config.toml has `*/1 * * * *` cron; (A-010) Edge Function builds all three payload fields; (A-011) SQL query has `wl.id IS NULL` filter; (A-012) Edge Function uses `SUPABASE_SERVICE_ROLE_KEY` not ANON key; (A-013/A-014) all useEffect cleanups present; (A-015) correct hex values for surface-anvil, surface-iron, surface-pit; (A-016) minimum text-[1.25rem] class on Inter text; (A-017) duration-[400ms] on board↔focused transitions. Report pass/fail per assertion.

🏁 **MILESTONE: Feature complete** -- verify all assertions, full drift check
- All 17 testable assertions verified by validator
- `bun run test` passes (all unit tests green)
- `bun run build` succeeds (no TypeScript errors)
- No TODO/FIXME stubs in new files

---

## Acceptance Criteria

- [ ] All 17 testable assertions from Spec.md verified (A-001 through A-017)
- [ ] All new unit tests passing (`bun run test`)
- [ ] TypeScript build clean (`bun run build`)
- [ ] No TODO/FIXME stubs in `src/components/display/`, `src/routes/display.tsx`, or `supabase/functions/display-idle-snapshot/`
- [ ] `supabase/config.toml` contains cron schedule for `display-idle-snapshot`
- [ ] Self-hosting docs updated with Remote Display section
- [ ] `IdleSnapshot` type exported from `src/domain/types/index.ts`
- [ ] `/display?clock=12h` renders 12-hour clock format

## Validation Commands

```bash
bun run test                              # All unit tests pass
bun run build                             # TypeScript clean, no errors
bun run lint                              # ESLint clean

# Manual: verify display route loads
open http://localhost:5173/display
open http://localhost:5173/display?clock=12h

# Manual: verify Edge Function
supabase functions serve display-idle-snapshot
curl -X POST http://localhost:54321/functions/v1/display-idle-snapshot

# Manual: verify cron config present
grep -A3 "display-idle-snapshot" supabase/config.toml
```
