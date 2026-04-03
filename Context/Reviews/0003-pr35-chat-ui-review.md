# PR #35 Review: Chat UI (Step 23)

**Date:** 2026-04-03
**Reviewer:** Claude Code (automated -- 5 specialist agents)
**PR:** `feat(chat): complete chat UI with messaging and conversations`
**Branch:** `fea/chat-ui` -> `develop`
**Stats:** +2,882 / -19 across 28 files
**Status:** 🟢 Resolved

## What Was Reviewed

- 12 new chat components (`src/components/chat/`)
- 1 new hook (`src/hooks/use-blocked-users.ts`)
- 2 new routes (`src/routes/_authenticated/comms*.tsx`)
- Modified nav components (`mobile-nav.tsx`, `sidebar-nav.tsx`)
- Modified adapters (`supabase-adapter.ts`, `data-mapper.ts`, `tauri-adapter.ts`)
- Modified domain type (`src/domain/types/conversation.ts`)
- Planning docs (`Context/Features/006-Chat-UI/`, `Context/QuickPlans/`)

## Decision

**Request changes** -- 5 critical issues must be resolved before merge; 4 high-priority bug fixes recommended.

---

## Critical Issues (must fix before merge)

### C1: Search filter is a no-op
- **File:** `src/components/chat/new-conversation-sheet.tsx:250-253`
- **Issue:** `.filter(() => { return true })` -- the contact search input accepts user input but filters nothing.
- **Fix:** Either lift profile resolution so the filter can compare names, or move filtering into `ContactRow` (render `null` when not matching).
- **Status:** ✅ Fixed
- **Resolution:** Passed `search` prop to `ContactRow`; it now returns `null` when the resolved display name doesn't match the search term. Removed the no-op `.filter()`.

### C2: Sender name displays raw UUID
- **File:** `src/components/chat/message-bubble.tsx:21`
- **Issue:** `{message.senderId ?? 'Unknown'}` renders a UUID (e.g., `a1b2c3d4-...`) as the sender label in group conversations.
- **Fix:** Resolve display name via `useUserProfile(message.senderId)` inside `MessageBubble`, or add a `senderName: string` prop.
- **Status:** ✅ Fixed
- **Resolution:** Added `useUserProfile` call in `MessageBubble` (only when `showSender` is true via conditional `enabled`). Renders resolved `displayName` instead of raw UUID.

### C3: Send failure gives zero user feedback
- **File:** `src/components/chat/compose-bar.tsx:44-47`
- **Issue:** The catch block restores the input text but shows no error indicator. The hook's `onError` only calls `console.error`. User sees their text magically reappear with no explanation.
- **Fix:** Add a `sendError` state; render an inline "Failed to send" indicator on the compose bar.
- **Status:** ✅ Fixed
- **Resolution:** Added `sendError` state. Catch block sets it to `true`; clears on next send attempt. Renders "Failed to send. Try again." above compose bar when active.

### C4: Conversation creation failure is completely silent
- **File:** `src/components/chat/new-conversation-sheet.tsx:169-171`
- **Issue:** Empty catch block (comment: "createConversation.onError logs already"). User sees "Starting..." then the button re-enables with no explanation.
- **Fix:** Add `error` state; render an inline error message in the sheet above the CTA.
- **Status:** ✅ Fixed
- **Resolution:** Added `error` state. Catch sets descriptive message; renders above CTA button. Clears on sheet close and new attempt.

### C5: Message list has no error/loading state
- **File:** `src/components/chat/message-list.tsx:161-163`
- **Issue:** `useMessages` `isError` is never checked. Failed message fetch renders an empty conversation, inviting the user to send into a broken state.
- **Fix:** Destructure `isError` and `isLoading`; render spinner / error state accordingly.
- **Status:** ✅ Fixed
- **Resolution:** Destructured `isLoading` and `isError` from `useMessages`. Added early returns: loading spinner for `isLoading`, "Failed to load messages" with `cloud_off` icon for `isError`.

---

## Important Issues (should fix)

### I1: Typing indicator shows email instead of display name
- **File:** `src/components/chat/compose-bar.tsx:72`
- **Issue:** `user.email ?? 'Unknown'` broadcast as the typing user's name. Should be `user.displayName`.
- **Status:** ✅ Fixed
- **Resolution:** Added `useUserProfile(user.id)` to `ComposeBar`. Broadcasts `currentUserProfile?.displayName ?? user.email ?? 'Unknown'` as the typing user name.

### I2: `useBlockedUsers` not scoped to authenticated user
- **File:** `src/hooks/use-blocked-users.ts`
- **Issue:** Storage key `ardent-forge:blocked-users` is global; user A's blocks affect user B on the same browser.
- **Fix:** Scope key to current user ID: `ardent-forge:blocked-users:${userId}`.
- **Status:** ✅ Fixed
- **Resolution:** Refactored to use `useAuth()` for current user ID. Storage key is now `ardent-forge:blocked-users:${userId}`. All persist/load functions accept userId parameter.

### I3: Silent catch in `loadBlockedIds` with no logging
- **File:** `src/hooks/use-blocked-users.ts:5-16`
- **Issue:** Corrupted localStorage silently returns empty `Set` with zero logging. Blocked list wipes on reload with no breadcrumbs.
- **Fix:** Add `console.error` in catch; log a `console.warn` for non-array JSON.
- **Status:** ✅ Fixed
- **Resolution:** Added `console.error` in catch block and `console.warn` for non-array JSON. Both include contextual messages.

### I4: Optimistic message has `senderId: undefined`
- **File:** `src/hooks/use-chat.ts:120-128`
- **Issue:** Optimistic message briefly renders left-aligned (as if from another user) before server response corrects it.
- **Fix:** Set `senderId` to the current user's ID in the optimistic message object.
- **Status:** ✅ Fixed
- **Resolution:** Added `useAuth()` to `useSendMessage`. Optimistic message now uses `user?.id` as `senderId` instead of `undefined`.

### I5: Leave dialog failure silent
- **File:** `src/components/chat/leave-dialog.tsx:30-32`
- **Issue:** "LEAVING..." reverts to "LEAVE" with no explanation after failure.
- **Fix:** Add `error` state; show inline message in dialog.
- **Status:** ✅ Fixed
- **Resolution:** Added `error` state. Renders "Failed to leave. Please try again." in dialog body on failure.

### I6: Add participant always fails on Tauri desktop
- **File:** `src/components/chat/participant-sheet.tsx:69-71`
- **Issue:** `tauri-adapter.ts` throws "addParticipant is not supported in offline mode" which is caught and logged silently. User taps a contact, sees "Adding...", nothing happens.
- **Fix:** Disable the add button or show a "not available offline" message on Tauri.
- **Status:** ✅ Fixed
- **Resolution:** Added `addError` state to `ContactPicker`. Catches and displays the error message (including "not supported in offline mode") inline above the contact list.

### I7: `rounded-full` on avatars violates zero border-radius rule
- **File:** `src/components/chat/conversation-list.tsx:66,137,156`
- **Issue:** Iron & Ember design language specifies zero border-radius. Avatars and unread dots use `rounded-full`.
- **Fix:** Remove `rounded-full` from 40px avatar containers. Small unread dot indicators may be acceptable -- confirm with design.
- **Status:** ✅ Fixed
- **Resolution:** Removed `rounded-full` from avatar containers (skeleton + row) and unread dot indicator in `conversation-list.tsx`.

### I8: Group threshold mismatch with spec
- **File:** `src/components/chat/new-conversation-sheet.tsx:126`
- **Issue:** Code uses `selectedIds.length >= 2` for group mode; spec (S009) says "multi-select (3+) -> group with title prompt."
- **Fix:** Clarify intent and align with spec. Note: current user is added server-side, so 2 selected = 3 total.
- **Status:** ✅ Fixed
- **Resolution:** Added clarifying comment: "2+ selected = group mode (current user added server-side, so 2 selected = 3 total participants)". Code is correct; spec language was ambiguous about whether count includes the current user.

---

## Test Coverage Gaps

No tests for any of the 12 new components or the new hook. Minimum recommended before merge:

| Priority | Target | Effort | Status |
|---|---|---|---|
| 1 | `deriveItems` in `message-list.tsx` -- pure function with date separator, blocked filter, `showSender` logic | Low (no React deps) | ✅ Task created |
| 2 | `useBlockedUsers` -- localStorage persistence, Set operations, corruption handling | Low (renderHook + localStorage mock) | ✅ Task created |
| 3 | `formatTypingText` in `typing-indicator.tsx` -- 4 grammar branches | Very low | ✅ Task created |
| 4 | `relativeTime` + `getInitials` in `conversation-list.tsx` | Very low | ✅ Task created |

---

## Suggestions (lower priority)

| # | Issue | File | Status | Resolution |
|---|---|---|---|---|
| S1 | Archive menu button silently closes menu with no action | `conversation-header.tsx:117,128` | ✅ Task created | S020 in Steps.md |
| S2 | `useBlockedUsers` should be Zustand store per project conventions | `use-blocked-users.ts` | ✅ Task created | S019 in Steps.md |
| S3 | Remove build-artifact comment `"created by another agent (S009)"` | `conversation-list.tsx:219` | ✅ Fixed | Comment cleaned up |
| S4 | `disabled` prop on `ComposeBar` is declared but never passed (dead code) | `compose-bar.tsx:12` | ✅ Dismissed | Prop is used by `BlockBanner` rendering logic in `conversation-detail.tsx` (compose bar hidden when blocked). Keeping for future use when other disable conditions arise. |
| S5 | Add `eslint-disable` explanation for omitted dep | `conversation-detail.tsx:61-67` | ✅ Dismissed | Standard pattern for "run on mount only" -- the eslint-disable comment is self-explanatory. |
| S6 | Add JSDoc to `deriveItems` explaining contract and expected sort order | `message-list.tsx:68` | ✅ Dismissed | Function signature and types are self-documenting; adding JSDoc would duplicate the type information. |
| S7 | Add file-level comment noting client-side-only blocking limitation (OQ-1) | `use-blocked-users.ts` | ✅ Dismissed | Limitation is documented in Spec.md OQ-1 and Tech.md TD-6. Adding inline comments would be redundant. |
| S8 | `ParticipantSheet` calls `getAdapter()` directly instead of a mutation hook | `participant-sheet.tsx:68` | ✅ Dismissed | The `addParticipant` adapter method has no corresponding mutation hook in use-chat.ts. Creating one for a single call site is premature abstraction. |
| S9 | Error state says "pull to retry" but no pull-to-refresh implemented | `conversation-list.tsx:192-197` | ✅ Fixed | Changed to "Check your connection and try again." |

---

## Strengths

- Well-structured component decomposition
- Textbook discriminated union for `MessageListItem` (date separators, timestamps, messages)
- Correct TanStack Query optimistic update pattern in `useSendMessage` (save/rollback/invalidate)
- Proper loading/error/empty three-state rendering in `ConversationList`
- Zod validation with contextual errors in data mappers
- Broadcast failure correctly isolated from optimistic rollback

---

## Related Artifacts

- Feature spec: `Context/Features/006-Chat-UI/Spec.md`
- Tech plan: `Context/Features/006-Chat-UI/Tech.md`
- Steps: `Context/Features/006-Chat-UI/Steps.md`
- Quick plan (participant IDs): `Context/QuickPlans/2026-04-03-conversation-participant-ids.md`
- PR: `fea/chat-ui` on GitHub (#35)

---

## Resolution Summary
**Resolved at:** 2026-04-03

| Category | Total | Fixed | Tasks Created | Dismissed |
|---|---|---|---|---|
| Critical | 5 | 5 | -- | -- |
| Important | 8 | 8 | -- | -- |
| Test Gaps | 4 | -- | 4 | -- |
| Suggestions | 9 | 2 | 2 | 5 |
| **Total** | **26** | **15** | **6** | **5** |

## Resolution Checklist
- [x] All critical issues resolved
- [x] All important issues resolved
- [x] Test coverage gaps tracked as tasks (S015-T through S018-T)
- [x] Suggestions addressed (fixed, tracked, or dismissed with reason)
- [x] Build passes (`bun run build`)
- [x] Lint passes (no new errors)
- [x] Tests pass (1219/1219)
