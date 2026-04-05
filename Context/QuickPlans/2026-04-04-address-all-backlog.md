# Quick Plan: Address All Backlog

**Date:** 2026-04-04
**Task:** Resolve all open backlog items: B001 (bug), P9-010 (domain type tests), P9-011 (unread counts test), and S-6 (N+1 query).
**Goal:** Clear the backlog to zero open items before starting the next feature.

---

## Items

### B001 -- invokeCommand missing log (High Bug)

**File:** `src/lib/tauri-adapter.ts:504-512`
**Approach:** In the `invokeCommand` catch block, add `console.error('[tauri-adapter] invokeCommand failed:', err)` before the re-throw. Must not swallow the error -- log then rethrow.
**Verification:** Catch block has `[tauri-adapter]` prefixed log and still re-throws `AdapterError`.

---

### P9-010 -- Domain type tests: conversation, message, media (High)

**File:** New test file alongside existing domain type tests (e.g. `src/domain/types/__tests__/chat.test.ts` or equivalent)
**Approach:** Add Vitest unit tests covering the Zod refinements added in PR #71:

- Direct conversation + `groupId` set → rejected
- Group conversation + `groupId` set → accepted
- `leftAt > joinedAt` → accepted; `leftAt < joinedAt` → rejected; `leftAt === joinedAt` → check boundary
- System message + `senderId` set → rejected
- Negative `durationSeconds` → rejected; zero → accepted
- Negative `fileSizeBytes` → rejected; zero → accepted

**Approach:** Check existing domain test files (e.g. `src/domain/types/__tests__/`) for pattern, then add `chat.test.ts` following the same structure.
**Verification:** `bun run test` passes with all new cases green.

---

### P9-011 -- getUnreadCounts batching test (Medium)

**File:** Test file for `getUnreadCounts` (likely in `src/lib/__tests__/` or co-located with the adapter tests)
**Approach:** Add Vitest tests for the `Promise.allSettled` behavior:

- All participations succeed → returns full map
- One participation fails → partial results returned (others still present); failed entry absent or defaulted
- Empty participations array → returns empty map
- `null` `last_read_at` → treated as "all unread" (0 read)
  **Verification:** All four cases covered and passing.

---

### S-6 -- findDirectConversation N+1 (Low)

**File:** `src/lib/tauri-adapter.ts` -- `findDirectConversation`
**Approach:** Replace the per-conversation loop with a single batched query that fetches all participant sets for the candidate conversation IDs in one IPC call, then filters in JS. If a batch IPC command doesn't exist, evaluate whether to add one or leave this deferred.
**Decision gate:** If no batch command exists and adding one is non-trivial (new Rust command needed), defer S-6 and leave it in the backlog as Low. Do not over-engineer.
**Verification:** `findDirectConversation` issues at most 2 IPC calls regardless of candidate count.

---

## Execution Order

1. B001 (5 min, isolated) -- fix first, trivial
2. P9-010 (domain type tests) -- add test file, ~10-15 cases
3. P9-011 (unread counts test) -- add test file, 4 cases
4. S-6 (N+1 query) -- investigate batch feasibility; defer if non-trivial

## Risks

- Domain type test file location: check existing pattern before creating
- S-6 may require a new Tauri command; if so, scope expands beyond quick plan -- defer
- `getUnreadCounts` test may need mock setup matching existing adapter test patterns

## Verification

- `bun run test` passes
- `bun run lint` clean
- Backlog items B001, P9-010, P9-011 removed; S-6 either resolved or re-evaluated
