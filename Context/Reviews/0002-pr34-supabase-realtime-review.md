# Review: PR #34 -- Supabase Realtime Integration

**Date:** 2026-04-02
**PR:** #34 `feat/supabase-realtime` -> `develop`
**Feature:** `Context/Features/005-Supabase-Realtime/`
**Title:** feat: Supabase Realtime, chat data layer, events & coach assignment
**Scope:** 19 files, +2188 / -76 lines
**Status:** 🟢 Resolved

## Files Reviewed

**New:**
- `src/lib/realtime-schemas.ts`
- `src/lib/realtime-manager.ts`
- `src/lib/foreground-detector.ts`
- `src/hooks/use-chat.ts`
- `src/components/chat-realtime-listener.tsx`

**Modified:**
- `src/lib/data-adapter.ts` (cursor-based getMessages signature)
- `src/lib/supabase-adapter.ts`
- `src/lib/tauri-adapter.ts`
- `src-tauri/src/commands/chat.rs`
- `src-tauri/src/event_reminder.rs` (clippy fix)
- `src-tauri/src/sync/pull.rs` (clippy fix)
- `src/lib/auth.tsx`
- `src/main.tsx`

---

## Critical Issues -- Must Fix Before Merge

### C1. Broadcast failure triggers incorrect optimistic rollback
**File:** `src/hooks/use-chat.ts:76-99`
**Status:** ✅ Fixed
**Resolution:** Wrapped `broadcastMessage` in try/catch inside `mutationFn`. Broadcast failure now logs a warning instead of propagating to `onError` rollback.

### C2. `sender_id: entityId` rejects empty-string fallback -- system messages will fail validation
**Files:** `src/lib/realtime-schemas.ts:13`, `src/hooks/use-chat.ts:92`, `src/lib/realtime-manager.ts:263`
**Status:** ✅ Fixed
**Resolution:** Changed `sender_id` from `entityId` (`z.string().min(1)`) to `z.string()` in the broadcast schema.

### C3. `removeAllChannels()` removes all Supabase channels, not just chat
**File:** `src/lib/realtime-manager.ts:193`
**Status:** ✅ Fixed
**Resolution:** Replaced `client.removeAllChannels()` with iterating `channels.values()` and calling `client.removeChannel(channel)` individually.

---

## Important Issues -- Should Fix

### I1. No reference counting -- `useRealtimeMessages` unmount tears down global channel
**File:** `src/hooks/use-chat.ts:239-242`
**Status:** ✅ Fixed
**Resolution:** Removed `manager.unsubscribe(conversationId)` from `useRealtimeMessages` cleanup. Channel lifecycle is owned by `ChatRealtimeListener`.

### I2. Catch-up path truncates message content to 100 chars
**File:** `src/lib/realtime-manager.ts:258-267`
**Status:** ✅ Fixed
**Resolution:** Removed `.slice(0, 100)` from the catch-up path in `handleForeground`. Catch-up messages now pass full content.

### I3. `onMessage` single-callback vs `addTypingListener` Set-based -- silent overwrite risk
**File:** `src/lib/realtime-manager.ts:26`
**Status:** ✅ Fixed
**Resolution:** Replaced `onMessage` nullable property with `addMessageListener(cb): () => void` using a Set of listeners, mirroring the `addTypingListener` pattern. Updated `ChatRealtimeListener` consumer.

### I4. Subscribe failure leaves dead channel in Map -- no retry possible
**File:** `src/lib/realtime-manager.ts:169-178`
**Status:** ✅ Fixed
**Resolution:** On terminal statuses (`TIMED_OUT`, `CHANNEL_ERROR`, `CLOSED`), the channel is now removed from the Map and cleaned up via `client.removeChannel()` so future `subscribe()` calls can retry.

### I5. `ChatRealtimeListener` mounted outside `AuthProvider` -- currentUserId race window
**Files:** `src/main.tsx:43`, `src/components/chat-realtime-listener.tsx:36-45`
**Status:** ✅ Fixed
**Resolution:** Moved `ChatRealtimeListener` inside `AuthProvider` in `main.tsx`. Replaced async `getSession()` + `onAuthStateChange` with `useAuth()` hook for synchronous access to `currentUserId`. Also used `initRealtimeManager()` return value directly, removing the dead `getRealtimeManager()` null check.

---

## Suggestions -- Nice to Have

| # | File | Suggestion | Status | Resolution |
|---|------|-----------|--------|------------|
| S1 | `realtime-manager.ts` | Extract `TYPING_EXPIRY_MS = 3_000` and `TYPING_DEBOUNCE_MS = 2_000` constants | ✅ Task created | S009 in Steps.md |
| S2 | `realtime-schemas.ts` | Extract `toMessageFromBroadcast(payload): Message` mapper | ✅ Task created | S010 in Steps.md |
| S3 | `realtime-manager.ts:169-178` | Remove empty `if (status === 'SUBSCRIBED')` branch | ✅ Task created | S011 in Steps.md |
| S4 | `realtime-manager.ts:85-89` | Simplify `clearAllTyping` iteration | ✅ Task created | S012 in Steps.md |
| S5 | `foreground-detector.ts:114` | Log the actual error before falling back to `visibilitychange` | ✅ Task created | S013 in Steps.md |
| S6 | `realtime-manager.ts:224` | Add `.catch(() => {})` to `broadcastTyping` channel.send | ✅ Task created | S014 in Steps.md |
| S7 | `data-adapter.ts:325` | Extract `MessagePaginationOptions` interface | ✅ Task created | S015 in Steps.md |
| S8 | `foreground-detector.ts:91-113` | Flatten nested `.then()` chain to `async/await` | ✅ Task created | S016 in Steps.md |
| S9 | `realtime-schemas.ts` | Add `z.string().max(200)` to typing payload `user_name` | ✅ Task created | S017 in Steps.md |
| S10 | `chat-realtime-listener.tsx:35` | Comment "no network call" for `getSession()` is inaccurate | ✅ Fixed (by I5) | S018 in Steps.md -- resolved by replacing getSession() with useAuth() |

---

## What Looks Good

- Cursor-based pagination correctly implemented across all 3 layers (Supabase adapter, Tauri adapter, Rust command) with DESC+reverse pattern
- Zod validation of broadcast payloads before cache insertion at the boundary
- Foreground detector race-condition guards (async dynamic import vs `stop()`) are thorough and well-documented
- Rust backend (`chat.rs`) is exemplary -- `?` propagation, guard clauses, transaction rollback
- Optimistic update structure in `useSendMessage` (onMutate/onError/onSettled) follows established pattern
- `SUBSCRIBED` branch comment explains the empty-string timestamp sentinel in `handleBackground`
- File naming and `@/` import aliases consistently follow project conventions
- Clippy fixes (`manual_range_contains`, `approx_constant`) are correct

---

## Decision

**Changes requested resolved.** All three critical issues (C1, C2, C3) and all five important issues (I1-I5) have been fixed inline. Ten suggestions tracked as S009-S018 in Steps.md for future work.

---

## Resolution Summary
**Resolved at:** 2026-04-02
**Session:** PR #34 review resolution

| Category | Total | Fixed | Tasks Created | Dismissed | Deferred |
|---|---|---|---|---|---|
| Critical [FIX] | 3 | 3 | -- | -- | -- |
| Important [FIX] | 5 | 5 | -- | -- | -- |
| Suggestions [TASK] | 10 | 1 (S10 by I5) | 9 | -- | -- |
| **Total** | **18** | **9** | **9** | **0** | **0** |

## Resolution Checklist

- [x] All critical issues fixed
- [x] All important issues fixed
- [x] Suggestions tracked in Steps.md (S009-S018)
- [x] Build passes (`bun run build`)
- [x] Review file updated with resolution status

---

## Related Artifacts

- Feature spec: `Context/Features/005-Supabase-Realtime/Spec.md`
- ADR: `Context/Decisions/ADR-005-cursor-based-message-pagination.md`
- Prior review: `Context/Reviews/0001-pr33-chat-data-layer-review.md`
