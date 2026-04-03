# Spec: Chat UI (Step 23)

**Feature:** 006-Chat-UI
**Status:** Draft
**Created:** 2026-04-03
**Source:** `docs/implementation-plan.md` Step 23a-g, `docs/12-prd-chat.md`, `docs/06-invariants.md` CH-1..CH-8

---

## Overview

Build the complete chat user interface: navigation tab, conversation list, conversation detail with virtualized messages, compose bar, new conversation flow, blocking, and group management. All UI follows Iron & Ember design language -- dark-only, zero border-radius, tonal surface layering, Space Grotesk headings, Inter body text.

## Problem Statement

Steps 21-22 delivered the full chat data layer (types, adapters, hooks, Supabase Realtime, optimistic sends, infinite pagination, typing indicators, foreground/background lifecycle). There is zero chat UI -- no routes, no components, no navigation entry. Users cannot access any chat functionality despite the infrastructure being complete.

## User Stories

1. **As a user**, I can tap the COMMS tab in the bottom nav (mobile) or sidebar (desktop) to see my conversations.
2. **As a user**, I see a list of all conversations sorted by most recent activity, with unread indicators.
3. **As a user**, I can start a new direct conversation with a friend or connection.
4. **As a user**, I can create an ad-hoc group conversation by selecting 3+ contacts.
5. **As a user**, I can open a conversation and see messages in a virtualized, scrollable list.
6. **As a user**, I can compose and send text messages with optimistic UI (pending indicator).
7. **As a user**, I see typing indicators when other participants are typing.
8. **As a user**, I can scroll up to load older messages (infinite scroll).
9. **As a user**, I can block/unblock another user from a direct conversation.
10. **As a user**, I can view participants, add members, or leave a group conversation.
11. **As a user**, I see an empty state when I have no conversations, with a CTA to start one.
12. **As a user**, I can tap the attachment button to open a picker (video, photo, workout, file) -- UI only, actual upload is Step 24.

## Requirements

### Must Have (P0)

| ID | Requirement | Invariant | Verification |
|----|-------------|-----------|--------------|
| M1 | COMMS tab in mobile bottom nav (`chat` icon) and desktop sidebar (below VAULT) | -- | Tab visible, routes to `/comms` |
| M2 | Conversation list screen at `/comms` sorted by `updated_at` desc | -- | Conversations render in recency order |
| M3 | Conversation row: avatar/initials, title, last message preview (truncated), relative timestamp | -- | All elements render correctly |
| M4 | Unread indicator: `ember` dot + bold title for conversations with unread messages | -- | Dot visible when `unreadCount > 0` |
| M5 | Empty state: "NO ACTIVE CHANNELS" centered with "START CONVERSATION" CTA | -- | Renders when user has no conversations |
| M6 | New conversation: contact picker, single select -> direct, multi-select (3+) -> group with title prompt | CH-2 | Existing direct conversation navigated to instead of duplicated |
| M7 | Conversation detail screen at `/comms/$conversationId` | -- | Route resolves, loads messages |
| M8 | Message bubbles: own (right, `surface-steel`), other (left, `surface-iron`) | -- | Alignment and colors correct |
| M9 | System messages: centered, no bubble, `body-small` in `text-secondary` | -- | System messages render distinctly |
| M10 | Sender names in group conversations (hidden in direct) | -- | Name shown/hidden by conversation type |
| M11 | Timestamp clustering: shown on first message after 5-minute gap | CH-5 | Timestamps appear at correct intervals |
| M12 | Date separators between day boundaries ("TODAY", "YESTERDAY", formatted date) | -- | Separators render at day changes |
| M13 | Pending message indicator: `schedule` icon next to own pending messages | -- | Clock icon visible for `syncStatus: 'pending'` |
| M14 | Compose bar: sticky bottom, underline input, send button (`ember` when has content), attachment button | -- | All elements present and functional |
| M15 | Send message via `useSendMessage` with optimistic update | -- | Message appears instantly, syncs in background |
| M16 | Typing indicator: "[Name] is typing..." with animated dots above compose bar | -- | Shows/hides based on `useRealtimeMessages` |
| M17 | Virtualized message list via `@tanstack/react-virtual` | -- | Smooth scroll with 500+ messages |
| M18 | Infinite scroll: scroll-up loads older messages via `useMessages` infinite query | -- | Older pages load when scrolling to top |
| M19 | Block/unblock from conversation header menu (direct conversations) | -- | Blocked user's messages hidden, indicator shown |
| M20 | Group participant list viewable from header | -- | Participant list accessible |
| M21 | Add participant to group conversation | -- | New member added via contact picker |
| M22 | Leave conversation with confirmation dialog | -- | User removed, system message generated |
| M23 | All touch targets >= 48px | -- | Verified via inspection |
| M24 | All UI follows Iron & Ember: zero border-radius, tonal layering, industrial vocabulary | -- | Visual audit |

### Should Have (P1)

| ID | Requirement | Verification |
|----|-------------|--------------|
| S1 | Attachment picker bottom sheet (mobile) / dropdown (desktop) with video, photo, workout, file options | Picker opens with 4 options |
| S2 | Conversation header: back button, title, participant count (groups), overflow menu | Header renders all elements |
| S3 | Scroll-to-bottom button when scrolled up with new message indicator | Button appears/disappears correctly |
| S4 | Loading skeletons matching conversation list card layout | Skeletons shown during initial load |
| S5 | Conversation list pull-to-refresh or manual refresh | Data refreshes on action |

### Won't Have (this step)

| ID | Exclusion | Reason |
|----|-----------|--------|
| W1 | Actual file/media upload or playback | Step 24 (Workout Sharing, Media) |
| W2 | Workout snapshot rendering in chat | Step 24 |
| W3 | Push notifications | Deferred per PRD |
| W4 | Message search | Not in PRD scope |
| W5 | Message reactions or editing | Not in PRD scope (CH-7 append-only) |
| W6 | Read receipts UI | Not in current PRD scope |
| W7 | Blocking persistence to database | Requires new `user_blocks` table -- out of scope for this UI step |

## Testable Assertions

| ID | Assertion | How to Test |
|----|-----------|------------|
| TA-1 | COMMS tab appears in both mobile bottom nav and desktop sidebar | Visual inspection at both breakpoints |
| TA-2 | Navigating to `/comms` renders conversation list or empty state | Route loads without error |
| TA-3 | Creating a new direct conversation with an existing contact navigates to existing conversation (CH-2) | Use `useFindDirectConversation` -> navigate if found |
| TA-4 | Message list renders 500+ messages without jank | Load test with large dataset, measure FPS |
| TA-5 | Scrolling to top triggers older message fetch | Network tab shows pagination request |
| TA-6 | Sending a message shows pending indicator, then resolves | Observe `schedule` icon -> disappears on sync |
| TA-7 | Typing indicator appears within 2 seconds of remote user typing | Test with two browser tabs |
| TA-8 | Unread count badge updates in real-time when new message arrives | Observe conversation list while receiving message |
| TA-9 | Blocking a user hides their messages in all conversations | Block user, verify messages filtered |
| TA-10 | Leaving a group conversation removes it from the list | Leave -> conversation no longer in list |
| TA-11 | Date separators appear between messages on different days | Send messages across midnight boundary |
| TA-12 | Timestamp clusters respect 5-minute gap rule | Send messages <5min apart -> single timestamp shown |

## Open Questions

| ID | Question | Impact | Resolution |
|----|----------|--------|------------|
| OQ-1 | Blocking is described in Step 23f, but there's no `user_blocks` table in the DB. Should blocking be client-side only (filter in UI) or deferred? | Blocking feature completeness | **Propose:** Client-side filtering only for now using local state. Full server-side blocking with a `user_blocks` table is a follow-up step. |
| OQ-2 | The attachment picker UI (Step 23e) shows options, but upload flows are Step 24. Should the picker be fully built but disabled, or stubbed? | UX completeness | **Propose:** Build the picker UI with all 4 options. Tapping an option shows a "Coming soon" toast until Step 24 delivers the upload flows. |
| OQ-3 | Should the contact picker for new conversations source from connections, group members, or both? | Contact picker scope | **Propose:** Both -- use existing connections and group co-members as the contact pool. |
| OQ-4 | Mobile bottom nav currently has 5 tabs + avatar. Adding COMMS makes 6 + avatar. Is that too many? | Navigation UX | **Propose:** Replace "Social" (`/groups`) with "Comms" (`/comms`) on mobile. Groups remain accessible from desktop sidebar and via deep links. Or: keep 5 tabs, replace Social with Comms, move Groups under a secondary nav. Need user decision. |

## Dependencies

### Upstream (required before this step)

| Dependency | Status | Notes |
|-----------|--------|-------|
| Chat data layer (Step 21) | Complete | Types, adapters, schemas, migrations |
| Supabase Realtime (Step 22) | Complete | RealtimeManager, hooks, ChatRealtimeListener |
| Navigation shell | Complete | SidebarNav + MobileNav in place |
| Design system (Iron & Ember) | Complete | All tokens, components available |
| `@tanstack/react-virtual` | Available | Already used in History page |

### Downstream (blocked by this step)

| Dependent | Step | What it needs |
|-----------|------|---------------|
| Workout Sharing in Chat | 24 | Conversation detail view, compose bar, attachment picker |
| Media & File Sharing | 24 | Attachment picker wired to upload flows |
| Chat Retention & Cleanup | 25 | Chat UI for testing retention behavior |
