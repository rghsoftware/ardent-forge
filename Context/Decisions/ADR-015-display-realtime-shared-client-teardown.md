# ADR-015: Shared `_client` teardown contract in `display-realtime.ts`

## Status

Accepted

## Context

`display-realtime.ts` houses both the publisher (phone → gym TV) and the subscriber
(gym TV) in a single module, sharing a `_client: SupabaseClient | null` reference.
Both halves must null `_client` on destroy to avoid retaining the Supabase client
across route unmounts, but neither can unconditionally null it because the other half
might still be active.

The original guards are asymmetric:

```typescript
// destroyDisplayPublisher (line 150)
if (!_subChannel) _client = null

// destroyDisplaySubscriber (line 260)
if (!_pubChannel && _pubGymId === null) _client = null
```

Both use channel handles (`_subChannel`, `_pubChannel`) as proxies for "the other half
is idle." This is unreliable during the retry window: `_subChannel` is nulled **before**
`scheduleRetry` is called (it is torn down and set to null at line 228), so from
`destroyDisplayPublisher`'s perspective, the subscriber appears idle even while a retry
timer is pending and the subscriber is still logically active. A caller that destroys
the publisher while a subscriber retry is in-flight will null `_client`, and when the
timer fires it will find `_client === null` and log an error instead of reconnecting —
a confusing failure mode with no obvious cause.

Review finding P16-015 raised the deeper question: are publisher and subscriber
**designed to co-exist** in the same browser session, or are they **mutually
exclusive**?

Inspecting the call sites:

- `src/hooks/use-display-broadcast.ts` mounts the publisher in the authenticated
  workout route (phone acting as athlete).
- `src/routes/display/gym/$gymId.tsx` mounts the subscriber in the display route
  (gym TV).

These routes are never active in the same browser session. The display route is
a fullscreen kiosk URL opened on a dedicated device; it never mounts alongside the
authenticated athlete UI. Publisher and subscriber are therefore **mutually
exclusive** in practice.

## Decision

Document and assert the mutual exclusion constraint rather than implement a
general-purpose co-existence mechanism.

Concretely:

1. **Each `destroy` function unconditionally nulls `_client` for its own role's
   state**, and uses a simple `_role` sentinel (or equivalent boolean flags) to
   determine whether to also null the shared reference. Because publisher and
   subscriber are mutually exclusive, in practice only one will ever be active, so
   this is equivalent to "always null on destroy."

2. **The shared `_client` is considered owned by whichever role initialized it.**
   `initDisplayPublisher` and `initDisplaySubscriber` both write to `_client`; the
   last writer wins. Each `destroy` nulls `_client` unconditionally, because the
   mutual exclusion guarantee means the other role is already idle.

3. **A `console.error` guard in each `destroy` makes the assumption explicit:**
   if both `_pubChannel` and `_subChannel` are non-null when either destroy is called,
   log an error — this should never happen in production and indicates a mount/unmount
   ordering bug.

Regarding the retry-window gap identified in P16-001 and P16-002: after those fixes
land, `subscribeToDisplay` clears any pending retry timer at entry (P16-002), and
the retry callback's null-client branch explicitly stops the loop and calls
`handlers.onStatusChange('disconnected')` (P16-001). Combined, these ensure a
destroyed subscriber does not silently continue reconnecting.

## Consequences

### Positive

- Teardown logic becomes explicit and auditable: the mutual exclusion assumption is
  documented in code comments, not implicit in channel-null checks.
- The retry-window race (P16-015) is mitigated by the P16-001/P16-002 fixes, which
  are more targeted than reworking the teardown contract.
- No new runtime state is required beyond what the P16-001/P16-002 fixes already
  introduce (`_subRetryTimer` clear at subscribe entry).

### Negative

- If a future feature does require publisher and subscriber to co-exist in the same
  session (e.g., a coach's tablet that both publishes its own workout and subscribes
  to a second athlete's display), the teardown contract will need revisiting. This
  ADR should be reviewed at that point.

### Neutral

- The asymmetric guards in the current code (`if (!_subChannel)` vs
  `if (!_pubChannel && _pubGymId === null)`) remain as-is for this PR. The
  authoritative fix is the P16-001/P16-002 pair. The teardown guards are
  opportunistic cleanup that fire only in the steady-state case (both halves
  are fully idle when either is destroyed), which is the common case.

## Alternatives Considered

### Add `_subActive` boolean sentinel

Introduce `_subActive: boolean` set by `initDisplaySubscriber`/`destroyDisplaySubscriber`
and checked in `destroyDisplayPublisher` instead of testing `_subChannel`. This would
be reliable during the retry window. Rejected because the mutual exclusion guarantee
makes it unnecessary complexity — the co-existence case we'd be guarding against
cannot occur with the current route structure.

### Always null `_client` unconditionally on each destroy

Simple and correct given mutual exclusion. Slightly less defensive (if someone does
accidentally mount both halves, destroying one kills the other's client). Rejected
in favor of the error-log guard approach, which makes the violation observable.

### Rearchitect with a shared `DisplayRealtimeClient` class

Replace module-scope state with an instantiated class that both sides hold a reference
to. The class manages the shared client lifecycle and tracks which sides are active.
Rejected as over-engineered for a module with exactly two callers that are never
concurrent.

## References

- Review finding P16-015: `Context/Reviews/0016-pr106-simplify-display-subsystem-2026-04-12.md`
- Review findings P16-001, P16-002: same file (retry-window fixes that mitigate the race)
- `src/lib/display-realtime.ts` — lines 150 and 260 (teardown guards)
- `src/hooks/use-display-broadcast.ts` — publisher mount site
- `src/routes/display/gym/$gymId.tsx` — subscriber mount site
