# Feature 012: TauriAdapter Unit Tests -- Implementation Steps

**Status:** Done
**Created:** 2026-04-04

## Team Composition

| Role        | Agent Type       | Rationale                                                                  |
| ----------- | ---------------- | -------------------------------------------------------------------------- |
| test-writer | backend-engineer | Single specialist -- all work is in one test file with one mock dependency |

This is a focused, single-file task. No cross-domain coordination needed, so a single specialist is sufficient.

## Implementation Steps

### Wave 1: Scaffolding + Helpers + Error Handling

#### S001: Scaffold test file with mock setup, fixtures, and conversion helper tests

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** nothing
**Parallel:** no (foundational)

**Tasks:**

1. Create `src/lib/__tests__/tauri-adapter.test.ts`
2. Add `vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))` before imports
3. Import `invoke` from `@tauri-apps/api/core`, `TauriAdapter`, `AdapterError` from `../tauri-adapter`
4. Define Tauri response fixtures at module level (matching `TauriXxxResponse` shapes -- integers for bools, JSON strings for objects):
   - `tauriExerciseResponse` (with `is_bilateral: 1`, `supports_1rm: 1`, `is_custom: 0`, `muscle_groups` as JSON string, etc.)
   - `tauriWorkoutLogResponse`
   - `tauriLoggedActivityGroupResponse`
   - `tauriLoggedActivityResponse`
   - `tauriLoggedSetResponse`
   - `tauriUserProfileResponse`
   - `tauriOneRepMaxHistoryResponse`
   - `tauriSessionTemplateResponse`, `tauriActivityGroupResponse`, `tauriActivityResponse`
   - `tauriProgramResponse`, `tauriBlockResponse`, `tauriBlockWeekResponse`, `tauriScheduledSessionResponse`
   - `tauriProgramActivationResponse`
   - `tauriAccountabilityGroupResponse`, `tauriGroupMemberResponse`, `tauriGroupInviteResponse`
   - `tauriDirectConnectionResponse`
   - `tauriConversationResponse`, `tauriMessageResponse`, `tauriMediaAttachmentResponse`
5. Add `beforeEach` with `vi.clearAllMocks()` and `adapter = new TauriAdapter('user-001')`
6. Write `describe('Error handling')`:
   - `describe('invokeCommand')`:
     - `it('wraps TauriAppError in AdapterError')` -- mock invoke to reject with `{ kind: 'NOT_FOUND', message: 'not found' }`, call any adapter method, assert `AdapterError` thrown with correct `kind` and `message`
     - `it('preserves field property on AdapterError')` -- reject with `{ kind: 'VALIDATION', message: '...', field: 'name' }`
     - `it('re-throws non-TauriAppError unchanged')` -- reject with `new Error('network')`, assert plain Error thrown
   - `describe('AdapterError')`:
     - `it('has name "AdapterError"')`
     - `it('maps all error kinds')` -- test each of NOT_FOUND, CONFLICT, VALIDATION, DATABASE, INTERNAL

**Acceptance criteria:**

- File compiles with no TypeScript errors
- Error handling tests pass
- Fixtures cover all Tauri response interfaces used by the adapter

---

### Wave 2: Core CRUD Operations

#### S002: Exercise operation tests

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S001
**Parallel:** no (same file, sequential waves)

**Tasks:**

1. `describe('Exercise operations')`:
   - `describe('getExercises')`:
     - `it('returns mapped exercises with no filters')` -- mock invoke to return `[tauriExerciseResponse]`, assert result has booleans (not ints), parsed objects (not JSON strings), correct field mapping
     - `it('passes category filter to invoke')` -- assert invoke called with `{ userId: 'user-001', category: 'BARBELL' }`
     - `it('passes movement pattern filter')`
     - `it('passes search filter')`
     - `it('passes customOnly filter')`
     - `it('returns empty array when no exercises')` -- mock invoke to return `[]`
   - `describe('getExercise')`:
     - `it('returns mapped exercise by id')`
     - `it('returns null when not found')` -- mock invoke to return `null`
   - `describe('createExercise')`:
     - `it('invokes create command with correct args and returns mapped result')`

**Validates:** TA1, TA3, TA4, TA7

#### S003: Workout log operation tests

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S002

**Tasks:**

1. `describe('Workout log operations')`:
   - `describe('getWorkoutLogs')` -- returns mapped list, passes userId and limit
   - `describe('getWorkoutLogsSummary')` -- returns summary list with limit/offset
   - `describe('getWorkoutLog')` -- returns single or null
   - `describe('getWorkoutLogFull')` -- mock invoke to return `{ log, groups, activities, sets }` composite, assert all sub-arrays mapped correctly (TA5)
   - `describe('createWorkoutLog')` -- correct args, returns mapped result
   - `describe('updateWorkoutLog')` -- correct args
   - `describe('deleteWorkoutLog')` -- invokes delete command
   - `describe('createLoggedActivityGroup')` -- correct args including userId
   - `describe('createLoggedActivity')` -- correct args
   - `describe('createLoggedSet')` -- correct args with set field mapping
   - `describe('updateLoggedSet')` -- correct args
   - `describe('createWorkoutLogFull')` -- complex creation with groups/activities/sets (TA5)

**Validates:** TA3, TA4, TA5

#### S004: User profile and 1RM tests

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S003

**Tasks:**

1. `describe('User profile operations')`:
   - `getUserProfile` -- returns mapped profile or null
   - `updateUserProfile` -- passes partial updates
2. `describe('One rep max operations')`:
   - `saveOneRepMax` -- correct args
   - `getOneRepMaxHistory` -- returns list
3. `describe('Exercise history')`:
   - `getRecentlyUsedExerciseIds` -- returns string array
   - `getExerciseWorkoutHistory` -- returns composite `WorkoutWithSets[]`

**Validates:** TA3, TA4

---

### Wave 3: Templates, Programs, Social

#### S005: Session template operation tests

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S004

**Tasks:**

1. `describe('Session template operations')`:
   - `getSessionTemplates` -- returns mapped list
   - `getSessionTemplate` -- single or null
   - `getSessionTemplateFull` -- composite with groups and activities
   - `createSessionTemplateFull` -- complex creation
   - `updateSessionTemplateFull` -- complex update
   - `deleteSessionTemplate` -- invokes delete
   - `cloneSessionTemplate` -- throws not implemented (TA6)

**Validates:** TA3, TA4, TA6

#### S006: Program and activation tests

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S005

**Tasks:**

1. `describe('Program operations')`:
   - `getPrograms` -- returns mapped list
   - `getProgramFull` -- composite with blocks/weeks/sessions
   - `createProgramFull` -- complex creation
   - `updateProgramFull` -- complex update
   - `deleteProgram` -- invokes delete
   - `assignProgramToMember` -- correct args
2. `describe('Program activation')`:
   - `getActiveProgram` -- returns activation or null
   - `setActiveProgram` -- correct args including optional startDate
   - `updateActiveProgram` -- passes partial updates
   - `clearActiveProgram` -- invokes clear

**Validates:** TA3, TA4

#### S007: Accountability group, member, invite, and connection tests

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S006

**Tasks:**

1. `describe('Accountability groups')`:
   - `createGroup`, `getGroups`, `getGroup`, `updateGroup`, `deleteGroup`
2. `describe('Group members')`:
   - `getGroupMembers`, `removeGroupMember`, `updateMemberRole`
3. `describe('Group invites')`:
   - `createInvite`, `getGroupInvites`, `revokeInvite`, `joinGroupByCode`
4. `describe('Direct connections')`:
   - `requestConnection`, `getConnections`, `getPendingConnections`, `acceptConnection`, `declineConnection`, `removeConnection`, `updateConnectionWriteAccess`
5. `describe('Activity feed')`:
   - `getGroupActivityFeed`, `getConnectionActivityFeed`

**Validates:** TA3, TA4

---

### Wave 4: Chat, Analytics, Stubs, Verification

#### S008: Chat operation tests

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S007

**Tasks:**

1. `describe('Chat operations')`:
   - `createConversation` -- correct args including type, participantIds, optional title/groupId
   - `getConversations` -- returns mapped list
   - `getConversation` -- single or null
   - `findDirectConversation` -- returns conversation or null
   - `sendMessage` -- correct args
   - `getMessages` -- passes before/limit options
   - `getMessagesSince` -- passes since param
   - `updateLastRead` -- invokes command
   - `getUnreadCounts` -- returns Map<string, number>
   - `addParticipant` -- correct args
   - `leaveConversation` -- invokes command
   - `toggleArchive` -- invokes command
   - `saveMediaAttachment` -- correct args
   - `getMediaAttachments` -- passes messageIds array
   - `updateMediaAttachment` -- throws not implemented (TA6)

**Validates:** TA3, TA4, TA6

#### S009: Analytics and standalone helper tests

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S008

**Tasks:**

1. `describe('Analytics')`:
   - `describe('getWeeklyVolume')` -- mock invoke to return raw workout data, assert weekly aggregation with correct week labels (exercises `getMonday`/`formatWeekLabel` indirectly)
   - `describe('getVaultSummary')` -- mock invoke, assert summary shape
2. `describe('Not-implemented stubs')`:
   - Test all methods that throw "not implemented": event item methods (`getEventItems`, `saveEventItem`, `updateEventItem`, `deleteEventItem`, `toggleEventItemPacked`, `reorderEventItems`), share link methods (`getShareLinks`, `getShareLinksForEntity`, `createShareLink`, `revokeShareLink`, `deleteShareLink`)
   - Each should throw with a descriptive message (TA6)

**Validates:** TA5, TA6

#### S009-T: Run full test suite and fix failures

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S009

**Tasks:**

1. Run `bun run test` -- ensure all new tests pass
2. Run `bun run lint` -- ensure no linting errors
3. Fix any TypeScript errors, assertion failures, or mock issues
4. Verify no existing tests are broken

**Validates:** TA8

---

### Wave 5: Review Follow-ups

#### S010: Add malformed JSON handling tests for parseJson

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S009-T

**Tasks:**

1. Add tests verifying behavior when Rust returns malformed JSON in fields like `aliases`, `muscle_groups`, `equipment_required`
2. Test with values like `"not-valid-json{"` to catch regressions in the conversion layer
3. Verify silent `undefined` propagation does not occur

**Review ref:** P9-004

---

#### S011: Add DATABASE and INTERNAL error kind tests

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S009-T

**Tasks:**

1. Add error handling tests for DATABASE error kind (most common production IPC failure)
2. Add error handling tests for INTERNAL error kind
3. Verify `AdapterError` correctly wraps these error shapes

**Review ref:** P9-005

---

#### S012: Add Supabase getUnreadCounts happy path test

**Agent:** test-writer
**Files:** `src/lib/__tests__/supabase-adapter.test.ts`
**Depends on:** S009-T

**Tasks:**

1. Add happy path test for `getUnreadCounts` where participations exist with actual unread messages
2. Verify the returned Map contains correct conversation IDs and counts

**Review ref:** P9-006

---

#### S013: Add isoToUnixSeconds edge case tests

**Agent:** test-writer
**Files:** `src/lib/__tests__/tauri-adapter.test.ts`
**Depends on:** S009-T

**Tasks:**

1. Add tests for `isoToUnixSeconds` with invalid ISO strings, empty strings, and null timestamps
2. Verify `NaN` is not silently propagated (could cause data corruption)
3. Test indirectly via adapter methods that use timestamp conversion

**Review ref:** P9-007

---

#### S014: Restore .bind() position comments in chat.rs INSERT OR REPLACE

**Agent:** test-writer
**Files:** `src-tauri/src/commands/chat.rs`
**Depends on:** S009-T

**Tasks:**

1. Locate the INSERT OR REPLACE query in chat.rs (~line 640 area)
2. Add position-numbered comments to each `.bind()` call matching the SQL parameter positions
3. Verify comments match the actual SQL column order

**Review ref:** P9-008

---

## Milestone Summary

| Milestone         | After Step | Testable Assertions                                   |
| ----------------- | ---------- | ----------------------------------------------------- |
| M1: Foundation    | S001       | TA1 (partial), TA2                                    |
| M2: Core CRUD     | S004       | TA1, TA3 (partial), TA4 (partial), TA5 (partial), TA7 |
| M3: Full Coverage | S009       | TA3, TA4, TA5, TA6                                    |
| M4: Green Suite   | S009-T     | TA8                                                   |

## Execution Recommendation

**Use `/impl 012`** -- this is a single-specialist, single-file task with no cross-domain coordination needed.
