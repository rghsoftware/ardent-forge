# Steps: Chat UI (Step 23)

**Feature:** 006-Chat-UI
**Status:** Draft
**Created:** 2026-04-03

---

## Team Composition

| Role | Agent | Scope |
|------|-------|-------|
| frontend-specialist-1 | Navigation + Routes + Conversation List | Nav changes, route files, list screen |
| frontend-specialist-2 | Conversation Detail + Messages | Header, message list, bubbles, virtualization |
| frontend-specialist-3 | Compose + Interactions | Compose bar, typing indicator, new conversation, attachment picker |
| frontend-specialist-4 | Group/Block + Polish | Participant sheet, block banner, leave dialog, unread badges |
| quality-engineer | Validation | Verify all acceptance criteria |

---

## Wave 1: Navigation & Routes (Foundation)

### S001: Add COMMS to navigation
**Agent:** frontend-specialist-1
**Files:** `src/components/layout/mobile-nav.tsx`, `src/components/layout/sidebar-nav.tsx`
**Depends on:** Nothing
**Parallel:** Yes (independent of S002)

- [ ] Mobile: Replace `Social` (`group`, `/groups`) with `Comms` (`chat`, `/comms`) in `navItems` array
- [ ] Desktop: Add `Comms` (`chat`, `/comms`) after `Vault` and before `Library` in `navItems` array
- [ ] Both navs import `useUnreadCounts` from `@/hooks/use-chat`
- [ ] Sum all unread counts into a total; display as an 8px `ember` dot on the COMMS icon when total > 0
- [ ] Touch targets remain >= 48px

**Acceptance:**
- COMMS tab visible at both breakpoints
- Tapping navigates to `/comms`
- Unread dot appears when conversations have unread messages
- TA-1

### S002: Create route files
**Agent:** frontend-specialist-1
**Files:** `src/routes/_authenticated/comms.tsx`, `src/routes/_authenticated/comms.$conversationId.tsx`
**Depends on:** Nothing
**Parallel:** Yes (independent of S001)

- [ ] `comms.tsx`: `createFileRoute('/_authenticated/comms')`, renders `<ConversationList />`
- [ ] `comms.$conversationId.tsx`: `createFileRoute('/_authenticated/comms/$conversationId')`, extracts `conversationId` param, renders `<ConversationDetail conversationId={conversationId} />`
- [ ] Both follow existing route patterns (thin delegates)
- [ ] Import paths use `@/components/chat/` prefix

**Acceptance:**
- Routes resolve without error
- TanStack Router route tree regenerates cleanly (`bun run build` passes)
- TA-2

---

## Wave 2: Conversation List Screen

### S003: Conversation list, rows, skeleton, empty state
**Agent:** frontend-specialist-1
**Files:** `src/components/chat/conversation-list.tsx`
**Depends on:** S002

- [ ] `ConversationList` component: uses `useConversations()` and `useUnreadCounts()`
- [ ] Loading state: `ConversationListSkeleton` -- 5 skeleton rows with zebra alternation (`surface-iron`/`surface-charcoal`), matching card dimensions
- [ ] Error state: centered icon (`cloud_off`) + "Failed to load conversations" + retry hint (match Pattern C from other screens)
- [ ] Empty state: `ConversationEmptyState` -- centered `chat` icon (48px, `text-warm-ash/30`), "NO ACTIVE CHANNELS" heading, description text, "START CONVERSATION" CTA button (`variant="default"`)
- [ ] `ConversationRow`: button, zebra rows, min-h-[60px]
  - Left: 40px circle avatar (`surface-steel` bg, initials in `ember` text) -- use `useUserProfile` to resolve other participant's `displayName` for direct conversations; group title for group conversations
  - Title: `font-heading text-sm text-bone-white` (bold if unread)
  - Last message preview: `text-xs text-warm-ash/60 truncate` single line
  - Right: relative timestamp (`text-xs text-warm-ash/60`), unread dot (8px `bg-ember` circle)
- [ ] Rows sorted by `updated_at` descending (already sorted by adapter)
- [ ] Tapping a row navigates to `/comms/${conversation.id}`
- [ ] "NEW" button (top-right, `variant="default"` size="sm") opens `NewConversationSheet`

**Acceptance:**
- Conversation list renders all conversations
- Unread indicator (dot + bold) shows correctly
- Empty state renders when no conversations
- Skeleton renders during loading
- TA-2, TA-8

### S003-D: User profile batch fetching consideration
**Agent:** frontend-specialist-1
**Note:** For the conversation list, each `ConversationRow` for a direct conversation needs the other user's display name. Use individual `useUserProfile(otherUserId)` calls per row. TanStack Query deduplicates and caches these. If performance becomes an issue with many conversations, batch fetching can be added later -- premature optimization to avoid now.

---

## Wave 3: Conversation Detail (Core)

### S004: Conversation header
**Agent:** frontend-specialist-2
**Files:** `src/components/chat/conversation-header.tsx`
**Depends on:** S002

- [ ] `ConversationHeader` props: `conversation: Conversation`, `onBack`, `onMenuAction`
- [ ] Back button: `arrow_back` icon, calls `onBack` (navigates to `/comms`)
- [ ] Title: `font-heading text-sm text-bone-white` -- display name for direct, title for group
- [ ] Participant count (group only): `text-xs text-warm-ash/60` -- "(N members)"
- [ ] Overflow menu: `more_vert` icon button -> uses a small popover/dropdown with actions:
  - Direct: "Block", "Archive"
  - Group: "Participants", "Leave", "Archive"
- [ ] Sticky top, `surface-anvil` background, `border-b border-ghost-line/15`

**Acceptance:**
- Header shows correct title and controls per conversation type

### S005: Message bubble and system message components
**Agent:** frontend-specialist-2
**Files:** `src/components/chat/message-bubble.tsx`
**Depends on:** Nothing

- [ ] `MessageBubble` props: `message: Message`, `isOwn: boolean`, `showSender: boolean`, `isPending: boolean`
- [ ] Own messages: right-aligned, `bg-surface-steel`, `max-w-[75%]`
- [ ] Other messages: left-aligned, `bg-surface-iron`, `max-w-[75%]`
- [ ] Content: `text-sm text-bone-white` (Inter)
- [ ] Sender name (when `showSender`): `text-xs text-ember` above bubble
- [ ] Pending indicator: `schedule` icon (16px, `text-warm-ash/50`) next to own pending messages
- [ ] `SystemMessage`: centered, no bubble, `text-xs text-warm-ash/60`, padding y
- [ ] Zero border-radius on all bubbles

**Acceptance:**
- Own/other messages styled correctly
- Sender names show in group, hidden in direct
- Pending messages show clock icon
- TA-6, TA-12

### S006: Virtualized message list with date separators and timestamp clusters
**Agent:** frontend-specialist-2
**Files:** `src/components/chat/message-list.tsx`
**Depends on:** S005

- [ ] `MessageList` props: `conversationId: string`, `conversationType: ConversationType`, `blockedUserIds: Set<string>`
- [ ] Uses `useMessages(conversationId)` infinite query
- [ ] Derives `MessageListItem[]` via `useMemo`:
  - Filter out messages from blocked users
  - Insert `date-separator` items at day boundaries ("TODAY", "YESTERDAY", or formatted date)
  - Insert `timestamp` items when gap > 5 minutes
  - Set `showSender` on first message after sender change or time gap (group only)
- [ ] `useVirtualizer` with:
  - `count = items.length`
  - `estimateSize`: date-separator=32, timestamp=24, message=64 (rough)
  - `getScrollElement` from a `ref`
  - Reverse layout semantics: start anchored to bottom
- [ ] Scroll-to-bottom on mount and on own message send
- [ ] Auto-scroll on new message if already at bottom
- [ ] Scroll-to-bottom floating button when scrolled up with new messages (positioned above compose bar)
- [ ] `DateSeparator`: centered label, `text-xs text-warm-ash/60`, `surface-charcoal` pill background
- [ ] `TimestampCluster`: centered, `text-xs text-warm-ash/40`
- [ ] Scroll up past threshold -> `fetchPreviousPage()` for older messages
- [ ] Show loading spinner at top when `isFetchingPreviousPage`

**Acceptance:**
- 500+ messages render smoothly (virtualized)
- Date separators at day boundaries
- Timestamps at 5-minute gaps
- Infinite scroll loads older messages
- TA-4, TA-5, TA-11, TA-12

---

## Wave 4: Compose & Interactions

### S007: Compose bar
**Agent:** frontend-specialist-3
**Files:** `src/components/chat/compose-bar.tsx`
**Depends on:** Nothing

- [ ] Sticky bottom, `bg-surface-anvil`, `border-t border-ghost-line/15`
- [ ] Text input: `bg-transparent`, underline style (`border-b-2 border-surface-steel focus:border-ember`), placeholder "Message..." in `text-warm-ash/50`
- [ ] Send button: `send` icon, `text-warm-ash/30` when empty, `text-ember` when has content, disabled when empty
- [ ] Attachment button: `attach_file` icon, left of input
- [ ] Enter key sends (desktop); Shift+Enter for newline
- [ ] On input change, call `getRealtimeManager()?.broadcastTyping(conversationId, userId, userName)`
- [ ] On submit: call `sendMessage({ conversationId, messageType: 'text', content })`, clear input
- [ ] Props: `conversationId: string`, `onSend: () => void` (for scroll-to-bottom trigger), `disabled?: boolean` (for blocked state)

**Acceptance:**
- Send button activates with content
- Messages send on Enter/button tap
- Input clears after send
- TA-6

### S008: Typing indicator
**Agent:** frontend-specialist-3
**Files:** `src/components/chat/typing-indicator.tsx`
**Depends on:** Nothing

- [ ] Uses `typingUsers` from parent (passed as prop from `ConversationDetail` which calls `useRealtimeMessages`)
- [ ] Renders above compose bar when `typingUsers.length > 0`
- [ ] Format: "[Name] is typing..." for 1 user, "[Name] and [Name] are typing..." for 2, "[N] people are typing..." for 3+
- [ ] Animated dots: 3 small circles with staggered opacity pulse animation (CSS keyframes)
- [ ] `text-xs text-warm-ash/60`, 24px height, smooth enter/exit transition

**Acceptance:**
- Typing indicator appears/disappears correctly
- TA-7

### S009: New conversation sheet with contact picker
**Agent:** frontend-specialist-3
**Files:** `src/components/chat/new-conversation-sheet.tsx`
**Depends on:** Nothing

- [ ] `NewConversationSheet`: `Sheet` (side="bottom" on mobile) with controlled `open`/`onOpenChange`
- [ ] `ContactPicker` inside:
  - Uses `useConnections()`, filters to `status === 'ACTIVE'`
  - Resolves display names via `useUserProfile` per connection
  - Search input to filter contacts by name
  - Each contact row: checkbox + avatar + name
  - Selected contacts shown as chips above the list
- [ ] Single selection: calls `useFindDirectConversation(otherUserId)`
  - If found: navigate to existing conversation (CH-2 compliance)
  - If not found: `useCreateConversation({ type: 'direct', participantIds: [otherUserId] })`
  - Navigate to `/comms/${conversation.id}` on success
- [ ] Multi-selection (3+ users): prompt for group title via inline input, then `useCreateConversation({ type: 'group', participantIds, title })`
- [ ] Loading and empty states for contact list
- [ ] "START" CTA button at bottom, disabled until selection made

**Acceptance:**
- Can create direct conversation
- Existing direct conversation navigated to (not duplicated)
- Can create group conversation with title
- TA-3

### S010: Attachment picker (stub)
**Agent:** frontend-specialist-3
**Files:** `src/components/chat/attachment-picker.tsx`
**Depends on:** Nothing

- [ ] `AttachmentPicker`: `Sheet` (side="bottom") on mobile, small popover on desktop
- [ ] 4 options as `surface-steel` cards in a 2x2 grid:
  - Video (`videocam`), Photo (`photo_camera`), Workout (`fitness_center`), File (`description`)
- [ ] Each option: icon + label, tappable
- [ ] On tap: show browser `alert('Coming soon')` (no toast library wired up yet -- keep it simple)
- [ ] Props: `open: boolean`, `onOpenChange: (open: boolean) => void`

**Acceptance:**
- Picker opens from compose bar attachment button
- All 4 options visible
- Tap shows "Coming soon" alert

---

## Wave 5: Group Management & Blocking

### S011: Participant sheet (group conversations)
**Agent:** frontend-specialist-4
**Files:** `src/components/chat/participant-sheet.tsx`
**Depends on:** Nothing

- [ ] `ParticipantSheet`: `Sheet` (side="bottom"), shows list of participants
- [ ] Each participant row: avatar (initials) + display name (via `useUserProfile`)
- [ ] "ADD MEMBER" button at bottom (opens a secondary contact picker filtered to connections not already in conversation)
- [ ] Add member calls existing `getAdapter().addParticipant(conversationId, userId)` (note: only works online via SupabaseAdapter)
- [ ] Invalidate conversations query on success

**Acceptance:**
- Participant list shows all current members
- Can add a new member
- TA-10

### S012: Block banner and client-side blocking
**Agent:** frontend-specialist-4
**Files:** `src/hooks/use-blocked-users.ts`, `src/components/chat/block-banner.tsx`
**Depends on:** Nothing

- [ ] `useBlockedUsers()` hook:
  - `blockedIds: Set<string>` backed by `localStorage` key `ardent-forge:blocked-users`
  - `blockUser(userId: string)`: add to set, persist
  - `unblockUser(userId: string)`: remove from set, persist
  - `isBlocked(userId: string)`: check membership
- [ ] `BlockBanner`: replaces compose bar when the other user in a direct conversation is blocked
  - "This conversation is blocked. Unblock to resume."
  - "UNBLOCK" button (`variant="ghost"`, `text-ember`)
- [ ] Block action: triggered from conversation header overflow menu, shows confirmation `Dialog`:
  - "Block [Name]? Their messages will be hidden in all conversations."
  - "BLOCK" destructive button + "CANCEL"
- [ ] Message filtering: `blockedUserIds` Set passed to `MessageList`, which filters them out in the `useMemo` derivation

**Acceptance:**
- Block/unblock toggles correctly
- Blocked messages hidden in message list
- Banner shows in blocked direct conversations
- Persists across page reloads
- TA-9

### S013: Leave conversation dialog
**Agent:** frontend-specialist-4
**Files:** `src/components/chat/leave-dialog.tsx`
**Depends on:** Nothing

- [ ] `LeaveDialog`: confirmation `Dialog` triggered from header overflow menu
- [ ] "Leave this conversation? You won't receive new messages."
- [ ] "LEAVE" destructive button + "CANCEL"
- [ ] On confirm: `useLeaveConversation().mutateAsync(conversationId)`, navigate to `/comms`

**Acceptance:**
- Leave confirmation shows
- Leaving removes conversation from list
- TA-10

---

## Wave 6: Integration & Assembly

### S014: Assemble ConversationDetail container
**Agent:** frontend-specialist-2
**Files:** `src/components/chat/conversation-detail.tsx`
**Depends on:** S004, S005, S006, S007, S008, S010, S011, S012, S013

- [ ] `ConversationDetail` props: `conversationId: string`
- [ ] Uses:
  - `useConversation(conversationId)` for metadata
  - `useRealtimeMessages(conversationId)` for `typingUsers`
  - `useUpdateLastRead()` -- call on mount and when new messages arrive while tab is focused
  - `useBlockedUsers()` for filtering and banner
  - `useAuth()` for current user ID
- [ ] Resolves other participant's profile via `useUserProfile` (direct conversations)
- [ ] Layout: flex column, full height
  - `ConversationHeader` (sticky top)
  - `MessageList` (flex-1, overflow)
  - `TypingIndicator` (conditional, above compose bar)
  - `ComposeBar` or `BlockBanner` (sticky bottom, depending on block state)
- [ ] Wires all child component props and callbacks
- [ ] Loading state: skeleton header + empty message area
- [ ] Not found state: "Conversation not found" centered message

**Acceptance:**
- All sub-components render correctly together
- Typing indicator shows above compose bar
- Blocked conversation shows banner instead of compose bar
- Last read updates on mount

### S014-T: Verify full flow end-to-end
**Agent:** quality-engineer
**Depends on:** S014

- [ ] `bun run build` succeeds (TypeScript + Vite)
- [ ] `bun run lint` passes
- [ ] Navigate to `/comms` -- list renders or empty state shows
- [ ] Create a new direct conversation -- navigates to detail
- [ ] Send a message -- appears with pending indicator, resolves
- [ ] Typing indicator appears in second tab
- [ ] Scroll up loads older messages
- [ ] Block user -- messages hidden, banner shows
- [ ] Unblock -- messages reappear, compose bar returns
- [ ] Leave group conversation -- removed from list
- [ ] Unread dot shows in nav when new message arrives
- [ ] All touch targets >= 48px
- [ ] All UI follows Iron & Ember (zero border-radius, correct surfaces, typography)
- [ ] Verify all 12 testable assertions from Spec.md

---

## Milestone Summary

| Wave | Tasks | Parallel | Description |
|------|-------|----------|-------------|
| 1 | S001, S002 | Yes | Navigation + routes |
| 2 | S003 | No | Conversation list screen |
| 3 | S004, S005, S006 | S004+S005 parallel, S006 after S005 | Conversation detail core |
| 4 | S007, S008, S009, S010 | All parallel | Compose + interactions |
| 5 | S011, S012, S013 | All parallel | Group mgmt + blocking |
| 6 | S014, S014-T | Sequential | Assembly + validation |

**Total:** 14 implementation tasks + 1 validation task
**Estimated agents:** 4 frontend specialists + 1 quality engineer
**Execution:** `/build` (tasks are isolated, no cross-domain coordination needed)

---

## Contract: Component Props Interface

Components in different waves must agree on props. Here are the contracts:

```typescript
// ConversationDetail -> MessageList
interface MessageListProps {
  conversationId: string
  conversationType: ConversationType
  blockedUserIds: Set<string>
  currentUserId: string
  onNewMessageAtBottom: () => void  // for scroll-to-bottom trigger
}

// ConversationDetail -> ComposeBar
interface ComposeBarProps {
  conversationId: string
  onSend: () => void
  disabled?: boolean
}

// ConversationDetail -> ConversationHeader
interface ConversationHeaderProps {
  conversation: Conversation
  displayName: string
  participantCount?: number
  onBack: () => void
  onBlock: () => void
  onLeave: () => void
  onViewParticipants: () => void
}

// ConversationDetail -> TypingIndicator
interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; userName: string }>
}

// ConversationList -> NewConversationSheet
interface NewConversationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (conversationId: string) => void
}

// ComposeBar -> AttachmentPicker
interface AttachmentPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}
```
