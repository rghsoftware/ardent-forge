# Tech Plan: Idle Mode + Edge Function

**Spec:** Context/Features/009-idle-mode/Spec.md
**Stacks involved:** React/TypeScript (display route, idle view), Supabase (Edge Function, Realtime Broadcast HTTP API)

---

## Architecture Overview

Idle mode extends the display pipeline established in Feature 008 with a second publisher: a server-side Edge Function that periodically broadcasts today's scheduled sessions. The display route (Step 28) already subscribes to the `display` Broadcast channel for `workout_snapshot` events. Idle mode adds a new `idle_snapshot` event type on the same channel, received by the same subscriber, and rendered when no active workout sessions are in the session map.

```
[Supabase Edge Function]          [Active Workout Phones]
    every 60 seconds                  on state change
         |                                  |
         v                                  v
   idle_snapshot event             workout_snapshot event
         |                                  |
         +---------------+------------------+
                         |
                         v
            Supabase Realtime Broadcast
                 channel: "display"
                         |
                         v
              /display route subscriber
                         |
              +----------+----------+
              |                     |
        Map is empty          Map has entries
              |                     |
              v                     v
         Idle View             Board / Focused View
```

The display route manages a `Map<string, DisplaySnapshot>` for active sessions (keyed by `user_id`). Idle mode adds a parallel `IdleSnapshot | null` state slot. When the session map is empty, the display renders `IdleView` using the most recent `idle_snapshot` payload (or a bare clock if no payload has arrived yet).

Transition logic lives in a single `useDisplayMode` hook that derives `'idle' | 'board' | 'focused'` from these two pieces of state. CSS class toggling drives the 300ms / 400ms transitions -- no JS animation library.

---

## Key Decisions

### D1: Extend `DisplayEventType` with `idle_snapshot`

**Options considered:**
- **(a) New Zod enum value `idle_snapshot` added to `display-snapshot.ts`** -- fits the existing discriminated event pattern; the display subscriber already switches on event type
- **(b) Separate channel (`idle`) for the Edge Function** -- avoids modifying the shared type file but requires the display to manage two channel subscriptions with different cleanup lifecycles
- **(c) HTTP polling from display route to a new Edge Function endpoint** -- no Broadcast channel complexity, but breaks the "no database queries from the display route" constraint (A-014 from Spec) and adds polling latency

**Chosen:** Option (a)  
**Rationale:** The display already switches on `DisplayEventType`. Adding `idle_snapshot` is a one-line Zod change, consistent with the established pattern. A single channel subscription is simpler to manage and clean up. Options (b) and (c) add complexity for no benefit.

**Change required:** `src/domain/types/display-snapshot.ts` -- add `'idle_snapshot'` to the `displayEventTypeSchema` enum and define `IdleSnapshot` Zod schema alongside `DisplaySnapshot`.

### D2: Edge Function broadcasts via Supabase Realtime HTTP API

**Options considered:**
- **(a) Supabase Realtime HTTP Broadcast API** -- `POST /realtime/v1/api/broadcast` with a JSON body; no persistent WebSocket; works from any HTTP client including Deno Edge Functions; uses the service_role key as Bearer token
- **(b) Persistent WebSocket in the Edge Function** -- Edge Function creates a Supabase client, subscribes to channel, sends events over WS. Rejected: Edge Functions are designed for short-lived HTTP request handlers; holding a persistent WS connection is unreliable and wasteful in this execution model
- **(c) pg_notify / Postgres trigger to push events** -- overly complex; Supabase Broadcast is not directly driven by pg_notify in the standard setup

**Chosen:** Option (a)  
**Rationale:** The Supabase Realtime HTTP broadcast endpoint is the documented, correct way to send Broadcast events from server-side code without a persistent connection. The request shape is:

```
POST https://<project-ref>.supabase.co/realtime/v1/api/broadcast
Authorization: Bearer <service_role_key>
Content-Type: application/json

{
  "messages": [
    {
      "topic": "realtime:display",
      "event": "idle_snapshot",
      "payload": { ...IdleSnapshot fields... }
    }
  ]
}
```

The `topic` must be prefixed with `realtime:` for broadcast channel routing. This is well-supported and does not require the Edge Function to maintain state between invocations.

### D3: Edge Function invoked by Supabase Cron (not pg_cron)

**Options considered:**
- **(a) Supabase Edge Function with cron schedule** -- configured in `supabase/config.toml` under `[functions.display-idle-snapshot.cron]`; universally available on all Supabase plans
- **(b) pg_cron Postgres extension** -- not available on Supabase free tier; requires Pro plan; rejected per open question resolution

**Chosen:** Option (a)  
**Rationale:** Resolved in Spec open questions. Supabase Edge Function cron is the portable option. Configuration in `supabase/config.toml`:

```toml
[functions.display-idle-snapshot]
verify_jwt = false

[functions.display-idle-snapshot.cron]
schedule = "*/1 * * * *"   # every 60 seconds
```

### D4: "Today's sessions" derived by joining program hierarchy, not a dedicated column

**Context:** `scheduled_sessions` has `day_of_week INTEGER (0-6)` matching JavaScript's `Date.getDay()`, but no `scheduled_time` or `completed` flag. There is no pre-computed "today's session for user X" view.

**Options considered:**
- **(a) Raw SQL JOIN traversal in Edge Function** -- walk `program_activations → programs → blocks → block_weeks → scheduled_sessions → session_templates` with a WHERE on `day_of_week = EXTRACT(DOW FROM NOW())` and a LEFT JOIN on `workout_logs` to check completion. Verbose but correct; runs in a single query with the service_role client.
- **(b) Create a Postgres VIEW or function** -- encapsulate the join; simpler Edge Function code. Added migration complexity for a view that has only one consumer.
- **(c) Supabase RPC function** -- same encapsulation benefit as (b), callable via `.rpc()` from the Supabase JS client.

**Chosen:** Option (c) -- Supabase RPC function  
**Rationale:** The query was extracted to a `get_display_idle_sessions` Postgres function callable via `.rpc()`. This encapsulates the multi-table JOIN in a migration-managed SQL function, keeping the Edge Function code simple. The Edge Function calls `supabase.rpc('get_display_idle_sessions')` rather than embedding raw SQL.

**Query sketch:**
```sql
SELECT
  up.display_name,
  st.name        AS session_name,
  ss.session_type,
  ss.day_label
FROM program_activations pa
JOIN programs p         ON p.id = pa.program_id
JOIN blocks b           ON b.program_id = p.id
                       AND b.ordinal = pa.current_block_ordinal
JOIN block_weeks bw     ON bw.block_id = b.id
                       AND bw.week_number = pa.current_week_number
JOIN scheduled_sessions ss ON ss.block_week_id = bw.id
                           AND ss.day_of_week = EXTRACT(DOW FROM NOW())
JOIN session_templates st  ON st.id = ss.session_template_id
JOIN user_profiles up      ON up.id = pa.user_id
LEFT JOIN workout_logs wl  ON wl.session_template_id = ss.session_template_id
                          AND wl.user_id = pa.user_id
                          AND DATE(wl.started_at) = CURRENT_DATE
                          AND wl.completed_at IS NOT NULL
WHERE up.display_visible = true
  AND wl.id IS NULL    -- not yet completed today
```

The Edge Function runs this with a service_role client (bypasses RLS), maps rows to `IdleSnapshot.scheduled_sessions`, and determines `next_session` as the first row (ordered by `pa.user_id` or a stable tiebreak -- no time-of-day ordering is possible since `scheduled_sessions` has no time column; order is display_name alphabetical).

**Note on `next_session`:** Because there is no `scheduled_time` column, `starts_in_seconds` in the `next_session` object cannot be derived from the database. Options: (i) omit `starts_in_seconds` from the payload and derive it from the typical training time stored in user preferences (not implemented); (ii) include `starts_in_seconds: null` in the payload and display "NEXT UP" without a countdown; (iii) omit `next_session.starts_in_seconds` entirely. **Decision: omit `starts_in_seconds`** -- the countdown badge in the spec (`NEXT UP IN X:XX`) is not achievable without a scheduled time. The badge will render as `NEXT UP: <session name>` without a countdown. This aligns with M-8 (no scheduled_time exists) and does not affect A-005 (badge renders), just changes what it says.

### D5: Clock drift prevention via server_time correction

The display runs `setInterval(() => setClock(new Date()), 1000)` -- standard one-second tick. Over hours of continuous operation, cumulative `setInterval` drift can amount to seconds per hour. The `idle_snapshot` payload includes `server_time` (ISO UTC timestamp from `now()` in the Edge Function).

**Options considered:**
- **(a) Replace local clock with `server_time` on each idle_snapshot** -- snaps the display clock to server time every 60 seconds; eliminates drift
- **(b) Use `server_time` as a correction offset** -- compute `localOffset = Date.now() - serverTime`, apply on each tick
- **(c) Ignore drift** -- acceptable for a gym TV where seconds of drift are imperceptible

**Chosen:** Option (a)  
**Rationale:** The simplest, most correct approach. Every 60 seconds when the idle_snapshot arrives, reset the clock state to the server-provided timestamp. The 60-second correction window means drift never exceeds a few hundred milliseconds in practice. No offset math needed.

### D6: Transitions via CSS class toggling, not Framer Motion

**Context:** The existing codebase has no JS animation library. Animations use `tw-animate-css` (Tailwind-compatible keyframe classes) and custom keyframes defined in `src/index.css` (`rise`, `forge-draw`, `ember-pulse`, `block-enter`).

**Chosen:** CSS transitions + `tw-animate-css` only  
**Rationale:** Adding Framer Motion for four transitions is not justified. The transitions required (fade + scale) are achievable with:
- `animate-in fade-in-0 duration-300` / `animate-out fade-out-0 duration-300` for idle-board cross-fades
- `animate-in zoom-in-95 duration-400` for focused expand
- Conditional `key` prop on view containers to trigger re-mount animations

Implementation: a `DisplayModeTransition` wrapper component that applies the correct `animate-in` / `animate-out` classes based on the previous and current mode. The `useDisplayMode` hook tracks both current and previous mode to drive transition direction.

### D7: URL search param for clock format

TanStack Router provides `validateSearch` on route definitions. The `/display` route will validate `{ clock?: '12h' | '24h' }` with a Zod schema and default to `'24h'`.

```ts
// src/routes/display.tsx
export const Route = createFileRoute('/display')({
  validateSearch: z.object({
    clock: z.enum(['12h', '24h']).optional().default('24h'),
  }),
  component: DisplayPage,
})
```

The display page reads `Route.useSearch().clock` to format the clock string.

### D8: Display route bypasses config and auth guards

The `__root.tsx` `beforeLoad` currently whitelists `/setup` and `/s/` prefix routes from the config check. The `/display` route must be added to this whitelist. It also must not redirect to sign-in if the user is unauthenticated -- the display is intentionally a public, no-auth page.

**Change:** Add `|| location.pathname.startsWith('/display')` to the `beforeLoad` guard in `__root.tsx`.

---

## Stack-Specific Details

### React/TypeScript

**Files to create:**

| File | Purpose |
|------|---------|
| `src/routes/display.tsx` | Display route shell -- full-viewport, no auth, validates `clock` search param |
| `src/components/display/idle-view.tsx` | Clock, date, session list, countdown badge |
| `src/components/display/use-display-mode.ts` | Hook: derives `'idle' \| 'board' \| 'focused'` from session map + focus state |
| `src/components/display/use-idle-snapshot.ts` | Hook: subscribes to `idle_snapshot` events, returns `IdleSnapshot \| null` |
| `src/components/display/display-mode-transition.tsx` | Wrapper applying correct tw-animate-css classes for each mode transition |
| `src/components/display/clock-display.tsx` | Large clock component, format from `clock` search param, server_time correction |

**Files to modify:**

| File | Change |
|------|--------|
| `src/domain/types/display-snapshot.ts` | Add `idle_snapshot` to `DisplayEventType` enum; add `IdleSnapshot` Zod schema and TypeScript type |
| `src/domain/types/index.ts` | Re-export `IdleSnapshot` |
| `src/routes/__root.tsx` | Whitelist `/display` in `beforeLoad` config check |

**Patterns to follow:**
- Route definition: follow `src/routes/s/$token.tsx` for a public no-auth route outside `_authenticated/`
- Hook naming: `use-[name].ts` files per `.claude/rules/react-typescript.md`
- Search param validation: Zod schema in `validateSearch` (TanStack Router v1 pattern)
- `useEffect` cleanup: return cleanup function from all subscriptions per rules

### Supabase

**Files to create:**

| File | Purpose |
|------|---------|
| `supabase/functions/display-idle-snapshot/index.ts` | Edge Function: query today's sessions, broadcast `idle_snapshot` |

**Files to modify:**

| File | Change |
|------|--------|
| `supabase/config.toml` | Add `[functions.display-idle-snapshot]` and `[functions.display-idle-snapshot.cron]` stanzas |

**Patterns to follow:**
- Deno runtime, ESM imports from `esm.sh` (match existing chat-media functions exactly)
- `Deno.serve(handler)` entry point
- CORS boilerplate (OPTIONS preflight) even though this function is cron-invoked (required for local testing via `supabase functions serve`)
- `createClient(url, serviceRoleKey)` -- no user auth header; this is a server-to-server call
- `Deno.env.get("SUPABASE_URL")` and `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`
- Error responses use `{ error: string }` JSON body with appropriate HTTP status

**No new migrations needed.** The `display_visible` column on `user_profiles` was added in Feature 008. No schema changes are required for idle mode.

---

## Integration Points

### `IdleSnapshot` schema contract

The Edge Function and the display subscriber must agree on the `idle_snapshot` payload shape. This is defined once in `src/domain/types/display-snapshot.ts` and imported by both the subscriber and (conceptually) the Edge Function. The Edge Function does not import from `src/` -- it defines the shape inline as a Deno-compatible Zod schema that must be kept in sync with the canonical definition.

```ts
// Canonical definition in src/domain/types/display-snapshot.ts
export const idleSnapshotSchema = z.object({
  server_time: isoDateTime,
  scheduled_sessions: z.array(z.object({
    display_name: z.string(),
    session_name: z.string(),
    session_type: sessionTypeSchema,
    day_label: z.string(),
  })),
  next_session: z.object({
    display_name: z.string(),
    session_name: z.string(),
  }).nullable(),
})

export type IdleSnapshot = z.infer<typeof idleSnapshotSchema>
```

### Display subscriber event routing

The `useIdleSnapshot` hook subscribes to the `display` channel (same channel as the existing display subscriber in Step 28). It must filter for `event === 'idle_snapshot'` and validate with `idleSnapshotSchema.safeParse`. The Step 28 subscriber filters for `workout_snapshot`, `session_ended`, `focus`, and `unfocus`. These hooks can share a single channel subscription or create independent subscriptions to the same channel -- Supabase Realtime allows multiple subscribers to the same channel without conflict.

**Decision: one channel, separate event filtering per hook.** The Step 28 subscriber hook handles workout-related events. The new `useIdleSnapshot` hook handles `idle_snapshot` events only. Both subscribe to `channel('display')` independently. Supabase's client-side channel management coalesces multiple subscriptions to the same channel name into one WebSocket message stream.

### Broadcast HTTP API call from Edge Function

```ts
// In display-idle-snapshot/index.ts
const broadcastUrl = `${Deno.env.get("SUPABASE_URL")}/realtime/v1/api/broadcast`
const response = await fetch(broadcastUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  },
  body: JSON.stringify({
    messages: [{
      topic: "realtime:display",
      event: "idle_snapshot",
      payload: idleSnapshotPayload,
    }]
  }),
})
```

---

## Risks and Unknowns

- **Risk: Supabase Realtime HTTP broadcast topic format** -- The topic prefix (`realtime:display` vs `display`) is underdocumented. If the wrong format is used, the display subscriber will not receive the event despite the broadcast succeeding.
  - **Mitigation:** Verify format against Supabase Realtime source / docs before implementation. Test with `supabase functions serve` locally against a running `supabase start` instance. Fallback: inspect the channel subscription topic string in the client-side publisher to confirm the expected format.

- **Risk: Edge Function cron not triggering on self-hosted Docker** -- Supabase self-hosted instances using the Docker Compose stack (Step 20) may require additional configuration to enable the Edge Function runtime and cron invocation.
  - **Mitigation:** Document in `docs/self-hosting.md` that the Edge Function runtime container must be included and the cron config must be applied. This is a deployment concern, not a code concern.

- **Risk: `next_session` has no time-of-day data** -- No `scheduled_time` column means no countdown timer. The spec's "NEXT UP IN X:XX" badge is not achievable as specified.
  - **Mitigation:** Implemented in D4 above -- badge renders as "NEXT UP: [session name]" without countdown. Testable assertion A-005 passes (badge renders with ember accent), but the countdown format changes. Update A-005 wording if needed during implementation.

- **Unknown: Multiple Supabase channel subscriptions to the same channel name** -- Whether the Supabase JS client merges or duplicates subscriptions when `client.channel('display')` is called twice from different hooks.
  - **Resolution plan:** Test locally during implementation. If subscriptions duplicate (each hook receives each event twice), refactor to a single shared channel subscription managed at the display route level, passed down as context or via a module-scope singleton matching the publisher pattern.

---

## Testing Strategy

### Unit Tests

| Test | What |
|------|------|
| `IdleSnapshot` Zod schema | Valid/invalid payloads, `next_session: null` case |
| `ClockDisplay` component | 12h/24h formatting, server_time correction resets internal state |
| `useDisplayMode` hook | Derives correct mode from session map + focus state combinations |
| `IdleView` rendering | Sessions list renders rows; countdown badge hidden when `next_session` is null |

### Integration / Manual Tests

| Test | How |
|------|-----|
| Edge Function local run | `supabase functions serve display-idle-snapshot`, invoke via curl, verify broadcast event appears in Supabase Realtime dashboard |
| End-to-end idle-to-board | Open `/display`, wait for idle state, start a workout on another tab/device, verify board view animates in |
| Clock drift | Leave `/display` open for 60+ minutes, verify clock stays within 1 second of system time |
| 12h URL param | Navigate to `/display?clock=12h`, verify clock renders in 12-hour format |

---

## ADR Candidates

No new ADRs required. The key decisions (D1-D8) are implementation-level and follow established patterns. The architectural decision to use Broadcast for the display is already captured in `13-prd-remote-display.md`. The decision to use Supabase Edge Function cron over pg_cron was resolved as a spec open question (not architecturally novel -- follows the same pattern as `chat-retention-cleanup` from Step 26).
