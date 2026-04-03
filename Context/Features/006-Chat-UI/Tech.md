# Tech: Chat UI (Step 23)

**Feature:** 006-Chat-UI
**Status:** Draft
**Created:** 2026-04-03

---

## Architecture Overview

Step 23 is a **pure frontend feature**. All backend infrastructure (database, RLS, adapters, Supabase Realtime, hooks) was delivered in Steps 21-22. This step creates ~15 new files (routes, components, one hook) and modifies 2 existing files (navigation).

### High-Level Component Tree

```
_authenticated.tsx (layout)
  |-- SidebarNav     (+ Comms item)
  |-- MobileNav      (Social -> Comms)
  |-- /comms         (new route)
  |     |-- ConversationList
  |     |     |-- ConversationRow (per item)
  |     |     |-- ConversationListSkeleton
  |     |     |-- ConversationEmptyState
  |     |-- NewConversationSheet (bottom sheet / dialog)
  |           |-- ContactPicker
  |-- /comms/$conversationId  (new route)
        |-- ConversationDetail
              |-- ConversationHeader
              |-- MessageList (virtualized)
              |     |-- MessageBubble
              |     |-- SystemMessage
              |     |-- DateSeparator
              |     |-- TimestampCluster
              |-- TypingIndicator
              |-- ComposeBar
              |     |-- AttachmentPicker (Sheet on mobile, Popover on desktop)
              |-- ParticipantSheet (group only)
              |-- BlockDialog (direct only)
              |-- LeaveDialog
```

---

## Key Technical Decisions

### TD-1: Route Structure

Two new route files under `src/routes/_authenticated/`:

| File | Route | Purpose |
|------|-------|---------|
| `comms.tsx` | `/comms` | Conversation list |
| `comms.$conversationId.tsx` | `/comms/:conversationId` | Conversation detail |

Follows the established pattern from `groups.tsx` / `groups.$groupId.tsx`. Each route file is thin -- delegates to a component.

### TD-2: Navigation Changes

**Mobile bottom nav:** Replace `Social` (`/groups`) with `Comms` (`/comms`, icon: `chat`). The 5-tab + avatar structure remains unchanged. Groups are still accessible via desktop sidebar, group deep links, and conversation context.

**Desktop sidebar:** Add `Comms` item (`chat` icon, `/comms`) after `Vault` and before `Library`. Total sidebar items go from 7 to 8.

### TD-3: Message List Virtualization Strategy

Use `@tanstack/react-virtual` (already a dependency, used in History page) with **reverse layout** semantics:

- Messages load newest-first from `useMessages` infinite query (pages ordered newest at bottom)
- `useVirtualizer` with `count = allMessages.length`, `estimateSize` based on message type
- Scroll anchored to bottom by default; new messages append and auto-scroll
- Scrolling up past a threshold triggers `fetchPreviousPage()` for older messages
- Variable row heights: text messages ~60px estimate, system messages ~40px, messages with sender name +20px

**Why not a dedicated chat virtualization library?** The codebase already uses `@tanstack/react-virtual` and it's sufficient for this use case. A dedicated library (e.g., `react-virtuoso`) would add a dependency for marginal benefit.

### TD-4: Timestamp Clustering and Date Separators

Processed as a **derived data transform** over the flat `allMessages` array, not stored in state:

```typescript
type MessageListItem =
  | { type: 'date-separator'; date: string }
  | { type: 'timestamp'; time: string }
  | { type: 'message'; message: Message; showSender: boolean }
```

A `useMemo` over `allMessages` produces this flattened list:
1. Insert `date-separator` when the date changes between adjacent messages
2. Insert `timestamp` when gap between adjacent messages exceeds 5 minutes
3. Set `showSender = true` for the first message after a gap or sender change (group only)

The virtualizer renders this heterogeneous list, with `estimateSize` keyed on item type.

### TD-5: Contact Picker Data Source

The contact picker for new conversations queries:
- `useConnections()` -- returns `DirectConnection[]` with `requesterId`/`recipientId` and `status: 'ACTIVE'`
- Filter to active connections only
- Display the "other user" (the one who isn't the current user)

Group co-members are not a separate query -- they're already connections by definition in this app's model. If needed later, `useGroupMembers` exists for the group detail page.

**User display:** The `DirectConnection` type has `requesterId`/`recipientId` but no display names. The contact picker will need to resolve user profiles. Check if there's an existing user profile lookup or if we need to query `auth.users` metadata. If no existing mechanism, use the Supabase `auth.users` table or a lightweight `profiles` view.

### TD-6: Blocking (Client-Side Only)

Per OQ-1 resolution: blocking is client-side filtering using React state (no database table).

- `useState<Set<string>>` for blocked user IDs, persisted to `localStorage`
- Blocked user's messages filtered out of the rendered message list via `.filter()`
- Block/unblock actions update the Set
- A "This conversation is blocked" banner replaces the compose bar for blocked direct conversations
- Unblock available from the banner or conversation menu

This is intentionally simple -- server-side blocking with a `user_blocks` table is a future step.

### TD-7: Compose Bar and Typing Broadcast

The compose bar manages:
- Text input state (`useState<string>`)
- Send on Enter (desktop) or Send button tap
- Typing broadcast: call `RealtimeManager.broadcastTyping()` on input change (already debounced at 2s internally)
- Attachment button opens `AttachmentPicker`

No form library needed -- it's a single text input with a submit action.

### TD-8: Attachment Picker (Stub)

Build the full picker UI (4 options: Video, Photo, Workout, File) as a `Sheet` (mobile) or `Popover` (desktop). Each option shows a toast "Coming soon" on tap. Step 24 will wire the actual upload flows.

### TD-9: Scroll-to-Bottom Behavior

- On mount and on sending a message: scroll to bottom
- On receiving a new message while already at bottom: auto-scroll
- On receiving a new message while scrolled up: show a floating "New message" indicator button
- Tapping the indicator scrolls to bottom and dismisses it

### TD-10: Unread Badge in Navigation

The `useUnreadCounts()` hook returns `Map<string, number>`. Sum all values for a total unread count. Display as a small badge on the COMMS tab icon in both mobile and desktop navigation.

---

## Component File Plan

All new files go in `src/components/chat/` and `src/routes/_authenticated/`:

| File | Component(s) | Notes |
|------|-------------|-------|
| `src/routes/_authenticated/comms.tsx` | Route: `/comms` | Thin, delegates to ConversationList |
| `src/routes/_authenticated/comms.$conversationId.tsx` | Route: `/comms/:conversationId` | Thin, delegates to ConversationDetail |
| `src/components/chat/conversation-list.tsx` | `ConversationList`, `ConversationRow`, `ConversationListSkeleton`, `ConversationEmptyState` | Main list screen |
| `src/components/chat/conversation-detail.tsx` | `ConversationDetail` | Container: header + messages + compose |
| `src/components/chat/conversation-header.tsx` | `ConversationHeader` | Back, title, participant count, menu |
| `src/components/chat/message-list.tsx` | `MessageList` | Virtualized, infinite scroll, date separators |
| `src/components/chat/message-bubble.tsx` | `MessageBubble`, `SystemMessage` | Own/other/system rendering |
| `src/components/chat/compose-bar.tsx` | `ComposeBar` | Input + send + attachment buttons |
| `src/components/chat/typing-indicator.tsx` | `TypingIndicator` | Animated dots with user names |
| `src/components/chat/attachment-picker.tsx` | `AttachmentPicker` | Sheet/Popover with 4 stub options |
| `src/components/chat/new-conversation-sheet.tsx` | `NewConversationSheet`, `ContactPicker` | Create direct or group conversation |
| `src/components/chat/participant-sheet.tsx` | `ParticipantSheet` | View/add/leave for group conversations |
| `src/components/chat/block-banner.tsx` | `BlockBanner` | Blocked conversation indicator + unblock |
| `src/hooks/use-blocked-users.ts` | `useBlockedUsers` | localStorage-backed blocked user set |

**Modified files:**

| File | Change |
|------|--------|
| `src/components/layout/mobile-nav.tsx` | Replace Social with Comms, add unread badge |
| `src/components/layout/sidebar-nav.tsx` | Add Comms item, add unread badge |

---

## Data Flow

### Conversation List
```
useConversations() --> ConversationList
useUnreadCounts() --> unread badges per row + nav badge
```

### Conversation Detail
```
useConversation(id) --> ConversationHeader (title, type, participants)
useMessages(id)     --> MessageList (infinite query, virtualized)
useSendMessage()    --> ComposeBar submit
useRealtimeMessages(id) --> TypingIndicator
useUpdateLastRead() --> called on mount + on new message while focused
useBlockedUsers()   --> filter messages, show BlockBanner
```

### New Conversation
```
useConnections()           --> ContactPicker (active connections)
useFindDirectConversation() --> check for existing direct before creating
useCreateConversation()    --> create + navigate to new conversation
```

---

## User Profile Resolution

`DirectConnection` contains `requesterId`/`recipientId` (UUIDs) but no display names. The conversation list and contact picker need user names. Two options:

**Option A:** Query Supabase `auth.users` via admin or create a `profiles` view. This requires a new migration.

**Option B:** Use the conversation title (already populated for group conversations) and for direct conversations, piggyback on existing data -- the `conversation_participants` join could be extended, or we use a lightweight RPC.

**Decision:** Check if there's already a user profile mechanism in the codebase. If not, create a minimal `profiles` view in a migration that exposes `id`, `full_name`, and `avatar_url` from `auth.users().raw_user_meta_data`. This is a small, self-contained addition that unblocks the UI.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Virtualized reverse scroll is tricky (anchor-to-bottom, prepend pages) | Scroll jumps, jank | Use `scrollToIndex` for anchor; test with 500+ messages early |
| No user profiles table -- names unavailable | Contact picker and message sender names broken | Add a `profiles` view migration as part of this step |
| `estimateSize` inaccuracy for variable-height messages | Scroll position drift | Use conservative estimates, measure actual after render |
| Mobile nav change (Social -> Comms) breaks muscle memory | User confusion | COMMS is higher-value real estate; Groups accessible from sidebar + deep links |
| Blocking is client-side only | Blocked users can still send messages (user sees them on reload) | Clearly documented as temporary; server-side blocking is a follow-up |

---

## Dependencies

| Package | Already Installed | Purpose |
|---------|-------------------|---------|
| `@tanstack/react-virtual` | Yes | Message list virtualization |
| `@tanstack/react-query` | Yes | All data fetching/mutations |
| `@tanstack/react-router` | Yes | Route definitions |
| `sonner` or toast library | Check | "Coming soon" toasts for attachment picker |

---

## ADRs

No new ADRs required for this step. All architectural decisions (adapter pattern, realtime strategy, optimistic updates) were made in Steps 21-22. The navigation change (Social -> Comms on mobile) is a UI decision, not an architectural one.
