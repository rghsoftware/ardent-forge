# PRD: Chat & File Sharing

## Overview

This document defines requirements for in-app messaging and media sharing in Ardent Forge. The feature enables user-to-user and group text chat, workout sharing into conversations, and short video/image sharing for lift critique and general communication. Chat is a post-v1 feature and is not required for the Phase 0 or Phase 1 milestones.

Chat builds on the social model defined in `02-prd-sharing.md` and reuses its relationship primitives (friend connections, groups, coach/member links). It does not introduce new relationship types.

### Cross-References

| Document                | Relationship                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `02-prd-sharing.md`     | Social model, group visibility, coach/member invariants                               |
| `03-prd-hosting.md`     | Supabase backend configuration; chat tables live in the same Postgres instance        |
| `04-prd-event-types.md` | Event type definitions; workout snapshots shared in chat reference these types        |
| `05-domain-model.md`    | Workout, Program, and Template entities referenced by workout sharing                 |
| `06-invariants.md`      | Chat invariants (CH-series) are added by this PRD                                     |
| `07-architecture.md`    | Data adapter extensions, Supabase Realtime integration, Cloudflare Stream integration |
| `08-erd.md`             | New tables: conversations, conversation_participants, messages, media_attachments     |

---

## Actors

| Actor  | Description                                                                                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User   | Any authenticated Ardent Forge user. Can send messages, share workouts and media, and create conversations.                                                            |
| Coach  | A user with the coach role in a group. Can create group chats for groups they coach. Same messaging capabilities as any user within conversations they participate in. |
| Member | A user who belongs to a group. Can participate in group chats for groups they have joined.                                                                             |
| System | Generates system messages for conversation lifecycle events (participant joined, participant left, conversation created).                                              |

---

## Conversation Types

Ardent Forge supports two conversation types. Both use the same underlying data model and differ only in participant cardinality and creation rules.

### Direct Conversations

A direct conversation is a one-to-one channel between two users. A direct conversation can only be created between users who share an accepted friend connection or an active coach/member relationship. The system enforces a uniqueness constraint: only one direct conversation may exist between any two users. If a direct conversation already exists, the app navigates to it rather than creating a duplicate.

Direct conversations cannot be renamed. The conversation title is always the other participant's display name. Direct conversations are never deleted; if one party blocks the other, the conversation becomes read-only for both participants until the block is lifted.

### Group Conversations

A group conversation is a multi-party channel associated with an Ardent Forge group entity. Any user with an accepted membership in the group may participate. Coaches and members have equal messaging capabilities within the conversation. Group conversations may also be created ad-hoc between any set of three or more users who share mutual friend connections, without requiring a formal group entity.

Group conversations have a user-defined title set at creation time and editable by any participant. Participants can leave a group conversation at any time. When a group conversation is associated with a group entity, new members who join the group are automatically added to the conversation. Members who are removed from the group are automatically removed from the conversation.

A group conversation has a maximum of 50 participants. This limit is chosen to keep Supabase Realtime Broadcast channel fan-out manageable and to reflect the niche community nature of the app. The limit applies to both group-entity-linked and ad-hoc group conversations.

---

## Messaging

### Message Types

Every message has a type that determines its rendering and content structure.

| Type    | Content                                                  | Rendering                                                                                                           |
| ------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Text    | Plain text body, maximum 2,000 characters                | Standard chat bubble with sender name and timestamp                                                                 |
| Workout | Frozen snapshot of a workout log, program, or template   | Workout card component (reuses existing workout display components) with a label indicating it is a shared snapshot |
| Media   | Reference to a Cloudflare Stream video asset or an image | Inline thumbnail with tap-to-expand; video plays in an embedded player                                              |
| File    | Reference to a file in Supabase Storage                  | File card with icon, filename, size, and download button                                                            |
| System  | Auto-generated lifecycle text                            | Centered, muted text without sender attribution                                                                     |

Text messages support no formatting (no Markdown, no rich text). This is a deliberate simplicity choice. If demand emerges, lightweight formatting (bold, italic) can be added later without schema changes since the content field is plain text.

### Workout Sharing

When a user shares a workout, program, or template into a conversation, the system creates a frozen snapshot of the entity at the moment of sharing. The snapshot is stored as a JSON payload within the message record. The snapshot captures all fields necessary to render the workout card: exercise names, sets, reps, weights, percentages, rest periods, and any notes. It does not include the source entity's ID or a live reference.

This snapshot approach ensures that the shared workout remains viewable even if the original entity is later deleted, made private, or modified. It also avoids permission edge cases where a recipient would need read access to the sender's workout data.

A future enhancement may add an optional "live link" message type that holds a reference to the source entity and resolves at render time, subject to the viewer's access permissions. This is not in initial scope.

### Media Sharing

Media messages contain a reference to an asset hosted on Cloudflare Stream (for video) or Supabase Storage (for images). The message record stores the provider name, the provider's asset identifier, a thumbnail URL, the media's duration (for video), and a processing status.

The upload flow is client-side: the app uploads directly to Cloudflare Stream using their direct creator upload API (TUS protocol for resumable uploads). No media binary passes through the Ardent Forge backend. The app creates the message record with status "processing" immediately upon upload initiation, updates it to "ready" when Cloudflare Stream reports transcoding is complete (via webhook or polling), and sets it to "failed" if transcoding fails or times out.

Images follow a simpler path: upload to Supabase Storage, store the public URL in the message, and display inline. Images are limited to 10 MB.

### File Sharing

File messages contain a reference to a document stored in Supabase Storage under the `chat-files` bucket. Files are limited to 25 MB and must match an explicit allowlist of document types (PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, ZIP). Executable content (exe, bat, sh, cmd, ps1, msi, app, dmg, jar, com, scr, vbs, wsf) is blocked on the client before upload; the bucket policy enforces the size limit as a second line of defense.

The upload flow mirrors the image path: the client uploads directly to Supabase Storage, and the resulting path is stored in a `media_attachments` row with `media_type = 'file'`. No transcoding or processing is required. The message record is created with status "ready" immediately upon upload confirmation.

File messages render as a file card showing a document-type icon derived from the MIME type, the original filename, the file size, and a download button. Inline preview is not provided in the initial release.

### Upload Constraints

| Constraint              | Value                                                          | Rationale                                                                                    |
| ----------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Maximum video duration  | 60 seconds                                                     | Lift critique clips are typically 15–60 seconds; keeps upload size under ~30 MB on mobile    |
| Maximum video file size | 50 MB                                                          | Safety cap; 60 seconds at 1080p/30fps is typically 25–35 MB                                  |
| Maximum image file size | 10 MB                                                          | Phone photos at full resolution rarely exceed this                                           |
| Allowed video formats   | MP4, MOV, WebM                                                 | Covers all major phone recording formats; Cloudflare Stream handles transcoding              |
| Allowed image formats   | JPEG, PNG, WebP, HEIC                                          | HEIC is common on iOS; Supabase Storage serves it as-is or the client converts before upload |
| Maximum file size       | 25 MB                                                          | Reasonable for documents; larger files should use external sharing                           |
| Allowed file formats    | PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, ZIP                       | Safe list covering common document types; excludes executables and scripts                   |
| Blocked extensions      | exe, bat, sh, cmd, ps1, msi, app, dmg, jar, com, scr, vbs, wsf | Prevents sharing of executable content                                                       |

### Message Ordering and Delivery

Messages are ordered by server-assigned timestamp (`created_at`). The server timestamp is authoritative; client-side timestamps are not used for ordering. This avoids clock-skew issues across devices.

Real-time delivery uses Supabase Realtime Broadcast on private channels. Each conversation maps to a Broadcast channel identified by the conversation ID. When a participant sends a message, the app writes the message to the `messages` table and simultaneously broadcasts a notification event on the channel. Connected participants receive the broadcast and append the message to their local view. Participants who are offline or not subscribed to the channel retrieve missed messages by querying the `messages` table on next connection, using their `last_read_at` cursor.

Typing indicators are ephemeral Broadcast events, not persisted. They are sent as a separate event type on the same channel and expire client-side after 3 seconds of inactivity.

---

## Conversation Lifecycle

### Creation

Direct conversations are created implicitly when a user initiates a message to another user from a profile screen, friend list, or coach roster. The app checks for an existing direct conversation and navigates to it if found.

Group conversations linked to a group entity are created explicitly by any member of the group, from the group detail screen. Ad-hoc group conversations are created by selecting multiple friends from a contact picker.

### Participant Management

For group-entity-linked conversations, participant management is automatic: joining the group adds the user to the conversation, leaving or being removed from the group removes them. For ad-hoc group conversations, any existing participant can add new participants (subject to the 50-person limit), and any participant can leave.

When a participant leaves, a system message is generated. The participant's sent messages remain visible to other participants. The participant loses access to the conversation and cannot rejoin unless re-invited (ad-hoc) or they rejoin the group (group-entity-linked).

### Blocking

When User A blocks User B, the following effects apply across all conversations where both are participants. User A no longer sees messages from User B (they are filtered client-side, not deleted). User B is not notified of the block. In direct conversations between A and B, neither party can send new messages. In group conversations, User B can still send messages visible to all other participants except User A. Blocking does not remove either user from any conversation.

---

## Message Retention

Messages are retained for 90 days from creation. After 90 days, a scheduled Supabase Edge Function or Postgres cron job deletes expired messages and their associated media references. Media assets on Cloudflare Stream are deleted via the Stream API when their referencing message is deleted.

Users may opt in to archiving for specific conversations. Archived conversations are exempt from the 90-day retention policy. Archiving is a per-user, per-conversation flag stored in the `conversation_participants` table. When a conversation is archived by one participant, it does not affect retention for other participants; however, the underlying messages are retained as long as at least one participant has the conversation archived.

The retention job must check all participants' archive flags before deleting a message. If any participant has archived the conversation, the message is retained.

---

## Offline Behavior

### Text Messages

Text messages composed while offline are stored in the local SQLite database with a `pending` sync status. When connectivity is restored, the sync engine pushes pending messages to Supabase Postgres. The message's `created_at` timestamp is set by the server upon receipt, not by the client at composition time. Pending messages are displayed in the conversation view with a visual indicator (clock icon) and are re-sorted into their final position once the server timestamp is assigned.

### Media

Media uploads require connectivity. If the user attempts to attach a video or image while offline, the app displays a clear message indicating that media sharing requires an internet connection. The app does not queue media uploads for later — this avoids the complexity of resumable upload state management across app restarts, and aligns with the principle that media binaries are cloud-only assets.

### Files

File uploads follow the same policy as media uploads: connectivity is required. If the user attempts to attach a file while offline, the app displays a message indicating that file sharing requires an internet connection. The app does not queue file uploads for later.

Thumbnails for previously viewed media are cached locally and displayed offline. Tapping a cached thumbnail while offline shows a message indicating that playback requires connectivity.

### Catch-Up on Reconnection

When the app comes online, it performs a catch-up query before subscribing to the Realtime Broadcast channel. The catch-up query fetches all messages in the user's conversations with a `created_at` greater than the user's `last_read_at` for each conversation. This ensures no messages are missed during the offline period. After catch-up completes, the app subscribes to the Broadcast channel for live updates.

---

## Notification Model

Push notifications are out of scope for the initial chat release. The notification model for chat is limited to in-app indicators.

### In-App Indicators

An unread badge appears on the chat tab icon showing the total count of conversations with unread messages. Each conversation in the conversation list shows the most recent message preview and a bold/unread treatment if there are messages newer than the user's `last_read_at`. Opening a conversation updates `last_read_at` to the most recent message's timestamp.

### Future: Push Notifications

Push notifications (APNs for iOS, FCM for Android) may be added in a later phase. The architecture should not preclude this: the `messages` table insert trigger can be extended to invoke a Supabase Edge Function that dispatches push notifications. This is documented here for architectural awareness but is explicitly deferred.

---

## Video Platform Integration

Ardent Forge uses Cloudflare Stream as the video hosting platform. The integration is designed to be swappable; all Cloudflare-specific logic is isolated behind a media provider interface in the data adapter layer.

### Upload Flow

The client obtains a direct creator upload URL from Cloudflare Stream via a Supabase Edge Function (which holds the Stream API token). The client uploads the video directly to Cloudflare using the TUS resumable upload protocol. On upload completion, Cloudflare transcodes the video to adaptive bitrate HLS. The Edge Function receives a webhook notification when transcoding completes and updates the `media_attachments` record status from "processing" to "ready." If transcoding fails or does not complete within 5 minutes, the status is set to "failed."

### Playback

Videos are played using the Cloudflare Stream embedded player or a standard HLS-compatible player (hls.js) consuming the HLS manifest URL stored in the `media_attachments` record. The player supports adaptive bitrate switching, which is important for mobile users on variable connections.

### Access Control

Video access is controlled via Cloudflare Stream's signed URL mechanism. The Supabase Edge Function generates a signed playback URL with a short TTL (1 hour) when a participant requests to view a video. The signed URL is returned to the client and used for playback. This ensures that only authenticated conversation participants can view shared videos.

### Cost Projection

At the expected initial scale (10 active users, ~20 clips per week, ~5 views per clip), monthly Cloudflare Stream costs are negligible — well under $5/month. The Starter Bundle at $5/month provides 1,000 minutes of storage and 5,000 minutes of delivery, which accommodates significant growth beyond the initial user base.

---

## Social Model Integration

Chat respects and extends the social model defined in `02-prd-sharing.md`.

### Relationship Requirements for Conversations

| Conversation Type     | Required Relationship                                    |
| --------------------- | -------------------------------------------------------- |
| Direct (friend)       | Accepted bidirectional friend connection                 |
| Direct (coach/member) | Active coach/member link in any group                    |
| Group (entity-linked) | Accepted membership in the group                         |
| Group (ad-hoc)        | Mutual friend connections among all initial participants |

### Group Visibility and Chat

The group entity's `member_visibility` flag controls whether members can see the full member list in the group detail UI. However, participation in a group chat constitutes consent to identity visibility within that chat. A user who joins a group and participates in its group chat is implicitly agreeing that other chat participants can see their display name and messages. This is an explicit design invariant: chat visibility is independent of group member list visibility.

The rationale is straightforward: you cannot have a conversation with someone and simultaneously hide your identity from them. Joining a group chat is a voluntary act that supersedes the member list visibility setting for the purpose of that chat.

### Coach Invariant

The existing coach invariant is preserved: coaches have write access to programs and templates, never to workout logs. Chat does not create any new path for coaches to modify member workout logs. Workout snapshots shared in chat are read-only frozen copies.

---

## Data Model

### New Tables

Four new tables are added to the Supabase Postgres schema. All four participate in the sync boundary and are replicated to local SQLite in Tauri mode (excluding media binaries, which are cloud-only references).

#### conversations

Stores conversation metadata. Each conversation has a type (direct or group), an optional title (for group conversations), and an optional reference to a group entity.

| Column     | Type        | Constraints                                   | Description                                                    |
| ---------- | ----------- | --------------------------------------------- | -------------------------------------------------------------- |
| id         | uuid        | PK, default gen_random_uuid()                 | Conversation identifier                                        |
| type       | text        | NOT NULL, CHECK (type IN ('direct', 'group')) | Conversation type                                              |
| title      | text        | nullable                                      | User-defined title; null for direct conversations              |
| group_id   | uuid        | nullable, FK → groups(id) ON DELETE SET NULL  | Link to group entity; null for ad-hoc and direct conversations |
| created_at | timestamptz | NOT NULL, default now()                       | Creation timestamp                                             |
| updated_at | timestamptz | NOT NULL, default now()                       | Last activity timestamp; updated on each new message           |

A unique partial index enforces the one-direct-conversation-per-pair constraint: for direct conversations, the pair of participant IDs (canonically ordered) must be unique. This is enforced via a unique index on `conversation_participants` for conversations where `type = 'direct'`.

#### conversation_participants

Junction table linking users to conversations. Tracks per-user state including read position and archive preference.

| Column          | Type        | Constraints                                        | Description                                                                                                                       |
| --------------- | ----------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| id              | uuid        | PK, default gen_random_uuid()                      | Record identifier                                                                                                                 |
| conversation_id | uuid        | NOT NULL, FK → conversations(id) ON DELETE CASCADE | Parent conversation                                                                                                               |
| user_id         | uuid        | NOT NULL, FK → user_profiles(id)                   | Participant                                                                                                                       |
| joined_at       | timestamptz | NOT NULL, default now()                            | When the user joined the conversation                                                                                             |
| last_read_at    | timestamptz | NOT NULL, default now()                            | Timestamp of the most recent message the user has seen; used for unread indicators and catch-up queries                           |
| is_archived     | boolean     | NOT NULL, default false                            | Whether this user has opted in to archiving; exempts messages from 90-day retention                                               |
| left_at         | timestamptz | nullable                                           | If set, the user has left the conversation; they retain read access to messages up to this timestamp but cannot send new messages |

Unique constraint on (conversation_id, user_id) prevents duplicate participation.

#### messages

Stores individual messages. The content column holds either plain text (for text messages), a JSON workout snapshot (for workout messages), or null (for media-only messages). Media references are stored in the separate `media_attachments` table to support messages with multiple attachments in the future, though the initial implementation allows only one attachment per message.

| Column          | Type        | Constraints                                                                        | Description                                                                    |
| --------------- | ----------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| id              | uuid        | PK, default gen_random_uuid()                                                      | Message identifier                                                             |
| conversation_id | uuid        | NOT NULL, FK → conversations(id) ON DELETE CASCADE                                 | Parent conversation                                                            |
| sender_id       | uuid        | nullable, FK → user_profiles(id)                                                   | Sender; null for system messages                                               |
| message_type    | text        | NOT NULL, CHECK (message_type IN ('text', 'workout', 'media', 'system'))           | Determines rendering                                                           |
| content         | text        | nullable                                                                           | Text body or JSON workout snapshot                                             |
| created_at      | timestamptz | NOT NULL, default now()                                                            | Server-assigned creation timestamp; authoritative for ordering                 |
| sync_status     | text        | NOT NULL, default 'synced', CHECK (sync_status IN ('pending', 'synced', 'failed')) | Local-only column for offline message queueing; not present in Postgres schema |

Index on (conversation_id, created_at) for efficient message history queries. Index on (conversation_id, created_at) WHERE created_at > now() - interval '90 days' for retention job efficiency.

#### media_attachments

Stores references to media assets hosted on external providers. No binary data is stored in the database.

| Column            | Type        | Constraints                                                                         | Description                                                                          |
| ----------------- | ----------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| id                | uuid        | PK, default gen_random_uuid()                                                       | Attachment identifier                                                                |
| message_id        | uuid        | NOT NULL, FK → messages(id) ON DELETE CASCADE                                       | Parent message                                                                       |
| provider          | text        | NOT NULL, CHECK (provider IN ('cloudflare_stream', 'supabase_storage'))             | Hosting provider                                                                     |
| provider_asset_id | text        | NOT NULL                                                                            | Provider's identifier for the asset (Cloudflare Stream UID or Supabase Storage path) |
| media_type        | text        | NOT NULL, CHECK (media_type IN ('video', 'image', 'file'))                          | Asset type                                                                           |
| thumbnail_url     | text        | nullable                                                                            | URL to a thumbnail image; populated after transcoding for videos                     |
| duration_seconds  | integer     | nullable                                                                            | Video duration; null for images                                                      |
| file_size_bytes   | bigint      | nullable                                                                            | Original file size                                                                   |
| original_filename | text        | nullable                                                                            | Original filename as uploaded; stored for display in the file card                   |
| mime_type         | text        | nullable                                                                            | MIME type of the uploaded file; used for icon selection and download headers         |
| status            | text        | NOT NULL, default 'processing', CHECK (status IN ('processing', 'ready', 'failed')) | Transcoding/upload status                                                            |
| created_at        | timestamptz | NOT NULL, default now()                                                             | Upload timestamp                                                                     |

### RLS Policies

Row Level Security on all four tables ensures that users can only access conversations they participate in.

The `conversations` table policy allows SELECT for any user who has a row in `conversation_participants` for that conversation where `left_at` is null. The `messages` table policy allows SELECT for any user who participates in the message's conversation, and INSERT only for participants who have not left the conversation. The `media_attachments` table policy inherits access from the parent message's conversation. The `conversation_participants` table allows users to SELECT their own participation records and those of other participants in shared conversations.

System-level operations (message retention cleanup, media deletion) run with the `service_role` key and bypass RLS.

### Sync Boundary

All four tables participate in the sync boundary. In Tauri mode, messages and conversation metadata are replicated to local SQLite for offline access. The `sync_status` column on `messages` exists only in the local SQLite schema and tracks offline message queueing. Media binaries are never synced locally; only the metadata (URLs, thumbnails, status) is replicated.

The sync engine treats messages as append-only within the sync boundary. Message edits and deletions (if added later) would require conflict resolution rules; for the initial release, messages are immutable after creation.

---

## Resolved Decisions

| #     | Question                     | Decision                                                                                      | Rationale                                                                                                                  |
| ----- | ---------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| CH-1  | Real-time delivery mechanism | Supabase Realtime Broadcast on private channels                                               | Aligns with existing stack; avoids new vendor; sufficient for expected scale of hundreds of concurrent connections         |
| CH-2  | Video hosting platform       | Cloudflare Stream                                                                             | Simpler pricing than Mux; free encoding; sufficient feature set for lift critique videos; swappable via provider interface |
| CH-3  | Message retention            | 90 days default with opt-in per-conversation archiving                                        | Balances storage cost and privacy expectations; archive flag is per-participant                                            |
| CH-4  | Workout sharing format       | Frozen snapshot at share time; live link deferred                                             | Avoids permission edge cases; self-contained for offline display; simpler implementation                                   |
| CH-5  | Maximum video duration       | 60 seconds                                                                                    | Covers lift critique use case; keeps uploads under ~30 MB for mobile                                                       |
| CH-6  | Group chat creation          | Any group member can create; joining a group chat is voluntary consent to identity visibility | Participation in chat supersedes `member_visibility` flag for that chat context                                            |
| CH-7  | Push notifications           | Deferred to a later phase                                                                     | Adds significant platform-specific complexity (APNs, FCM); not essential for a 10-user friends-and-family deployment       |
| CH-8  | Moderation tooling           | Not in scope; `blocked_users` table provides basic user-level blocking                        | Community is friends and family; contributors can add moderation if they fork or scale                                     |
| CH-9  | Image hosting                | Supabase Storage (existing infrastructure)                                                    | Images are small, static files; no transcoding needed; avoids adding a second external provider for non-video media        |
| CH-10 | Message editing/deletion     | Not in initial scope; messages are immutable after creation                                   | Simplifies sync boundary (append-only); can be added later with conflict resolution rules                                  |
| CH-11 | Generic file sharing         | Supabase Storage `chat-files` bucket with allowlist and 25 MB cap                             | Avoids adding a third external provider; document types are low-risk and well-understood; inline preview deferred          |
