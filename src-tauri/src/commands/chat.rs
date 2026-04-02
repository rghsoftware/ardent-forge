use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::{ConversationParticipantRow, ConversationRow, MediaAttachmentRow, MessageRow};
use crate::utils::now_unix;

// ---------------------------------------------------------------------------
// Composite structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationWithParticipants {
    pub conversation: ConversationRow,
    pub participants: Vec<ConversationParticipantRow>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnreadCount {
    pub conversation_id: String,
    pub count: i64,
}

// ---------------------------------------------------------------------------
// Input structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateConversationInput {
    pub conversation_type: String,
    pub title: Option<String>,
    pub group_id: Option<String>,
    pub participant_user_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendMessageInput {
    pub conversation_id: String,
    pub sender_id: Option<String>,
    pub message_type: String,
    pub content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveMediaAttachmentInput {
    pub id: Option<String>,
    pub message_id: String,
    pub provider: String,
    pub provider_asset_id: Option<String>,
    pub media_type: String,
    pub original_filename: Option<String>,
    pub mime_type: Option<String>,
    pub thumbnail_url: Option<String>,
    pub playback_url: Option<String>,
    pub duration_seconds: Option<i64>,
    pub file_size_bytes: Option<i64>,
    pub status: String,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Creates a new conversation with the given participants in a single
/// transaction.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `input`: Conversation header and participant user IDs.
///
/// # Returns
/// The created conversation with all its participants.
#[tauri::command]
pub async fn create_conversation(
    pool: State<'_, SqlitePool>,
    input: CreateConversationInput,
) -> Result<ConversationWithParticipants, AppError> {
    // Validation
    if input.participant_user_ids.is_empty() {
        return Err(AppError::validation(
            "participant_user_ids",
            "At least one participant is required",
        ));
    }

    let valid_types = ["direct", "group"];
    if !valid_types.contains(&input.conversation_type.as_str()) {
        return Err(AppError::validation(
            "conversation_type",
            &format!(
                "Invalid conversation_type: {}. Valid values: {:?}",
                input.conversation_type, valid_types
            ),
        ));
    }

    let conversation_id = Uuid::new_v4().to_string();
    let now = now_unix();

    let mut tx = pool.begin().await?;

    // Insert conversation (use quoted "type" since it is a reserved keyword)
    sqlx::query(
        "INSERT INTO conversations \
         (id, \"type\", title, group_id, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&conversation_id)
    .bind(&input.conversation_type)
    .bind(&input.title)
    .bind(&input.group_id)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    // Insert participants
    let mut participants: Vec<ConversationParticipantRow> = Vec::new();
    for user_id in &input.participant_user_ids {
        let participant_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO conversation_participants \
             (id, conversation_id, user_id, is_archived, joined_at) \
             VALUES (?, ?, ?, 0, ?)",
        )
        .bind(&participant_id)
        .bind(&conversation_id)
        .bind(user_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        let row = sqlx::query_as::<_, ConversationParticipantRow>(
            "SELECT * FROM conversation_participants WHERE id = ?",
        )
        .bind(&participant_id)
        .fetch_one(&mut *tx)
        .await?;
        participants.push(row);
    }

    let conversation = sqlx::query_as::<_, ConversationRow>(
        "SELECT id, \"type\", title, group_id, created_at, updated_at \
         FROM conversations WHERE id = ?",
    )
    .bind(&conversation_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(ConversationWithParticipants {
        conversation,
        participants,
    })
}

/// Lists all conversations for a given user, ordered by most recently updated.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `user_id`: The current user's ID.
///
/// # Returns
/// A vector of conversations with their participants.
#[tauri::command]
pub async fn get_conversations(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<ConversationWithParticipants>, AppError> {
    // Fetch conversation IDs for this user (not left)
    let conversations = sqlx::query_as::<_, ConversationRow>(
        "SELECT c.id, c.\"type\", c.title, c.group_id, c.created_at, c.updated_at \
         FROM conversations c \
         JOIN conversation_participants cp ON cp.conversation_id = c.id \
         WHERE cp.user_id = ? AND cp.left_at IS NULL \
         ORDER BY c.updated_at DESC",
    )
    .bind(&user_id)
    .fetch_all(pool.inner())
    .await?;

    if conversations.is_empty() {
        return Ok(Vec::new());
    }

    // Fetch all participants for these conversations in one query
    let conv_ids: Vec<String> = conversations.iter().map(|c| c.id.clone()).collect();
    let placeholders = conv_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT * FROM conversation_participants \
         WHERE conversation_id IN ({placeholders})"
    );
    let mut query = sqlx::query_as::<_, ConversationParticipantRow>(&sql);
    for cid in &conv_ids {
        query = query.bind(cid);
    }
    let all_participants = query.fetch_all(pool.inner()).await?;

    // Group participants by conversation_id
    let mut participant_map: std::collections::HashMap<String, Vec<ConversationParticipantRow>> =
        std::collections::HashMap::new();
    for p in all_participants {
        participant_map
            .entry(p.conversation_id.clone())
            .or_default()
            .push(p);
    }

    let results = conversations
        .into_iter()
        .map(|conv| {
            let participants = participant_map.remove(&conv.id).unwrap_or_default();
            ConversationWithParticipants {
                conversation: conv,
                participants,
            }
        })
        .collect();

    Ok(results)
}

/// Fetches a single conversation with its participants.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `id`: The conversation's unique identifier.
///
/// # Returns
/// `Some(ConversationWithParticipants)` if the conversation exists, or `None`.
#[tauri::command]
pub async fn get_conversation(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<ConversationWithParticipants>, AppError> {
    let conversation = sqlx::query_as::<_, ConversationRow>(
        "SELECT id, \"type\", title, group_id, created_at, updated_at \
         FROM conversations WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool.inner())
    .await?;

    let conversation = match conversation {
        Some(c) => c,
        None => return Ok(None),
    };

    let participants = sqlx::query_as::<_, ConversationParticipantRow>(
        "SELECT * FROM conversation_participants WHERE conversation_id = ?",
    )
    .bind(&id)
    .fetch_all(pool.inner())
    .await?;

    Ok(Some(ConversationWithParticipants {
        conversation,
        participants,
    }))
}

/// Sends a message in a conversation.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `input`: Message payload (conversation_id, sender_id, type, content).
///
/// # Returns
/// The created `MessageRow` with `sync_status = 'pending'`.
#[tauri::command]
pub async fn send_message(
    pool: State<'_, SqlitePool>,
    input: SendMessageInput,
) -> Result<MessageRow, AppError> {
    let valid_types = ["text", "workout", "media", "file", "system"];
    if !valid_types.contains(&input.message_type.as_str()) {
        return Err(AppError::validation(
            "message_type",
            &format!(
                "Invalid message_type: {}. Valid values: {:?}",
                input.message_type, valid_types
            ),
        ));
    }

    let id = Uuid::new_v4().to_string();
    let now = now_unix();

    let mut tx = pool.begin().await?;

    sqlx::query(
        "INSERT INTO messages \
         (id, conversation_id, sender_id, message_type, content, \
          created_at, updated_at, sync_status) \
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')",
    )
    .bind(&id)
    .bind(&input.conversation_id)
    .bind(&input.sender_id)
    .bind(&input.message_type)
    .bind(&input.content)
    .bind(now)
    .bind(now)
    .execute(&mut *tx)
    .await?;

    // Update conversation's updated_at to keep sort order current
    sqlx::query("UPDATE conversations SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&input.conversation_id)
        .execute(&mut *tx)
        .await?;

    let row = sqlx::query_as::<_, MessageRow>("SELECT * FROM messages WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(row)
}

/// Fetches paginated messages for a conversation.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `conversation_id`: The conversation to fetch messages for.
/// - `limit`: Maximum number of messages to return (default 50).
/// - `offset`: Number of messages to skip (default 0).
///
/// # Returns
/// A vector of `MessageRow` ordered by `created_at` ascending.
#[tauri::command]
pub async fn get_messages(
    pool: State<'_, SqlitePool>,
    conversation_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<MessageRow>, AppError> {
    let lim = limit.unwrap_or(50);
    let off = offset.unwrap_or(0);

    let rows = sqlx::query_as::<_, MessageRow>(
        "SELECT * FROM messages \
         WHERE conversation_id = ? \
         ORDER BY created_at ASC \
         LIMIT ? OFFSET ?",
    )
    .bind(&conversation_id)
    .bind(lim)
    .bind(off)
    .fetch_all(pool.inner())
    .await?;

    Ok(rows)
}

/// Updates the last-read timestamp for a user in a conversation.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `conversation_id`: The conversation to mark as read.
/// - `user_id`: The user who is reading.
///
/// # Returns
/// The updated `ConversationParticipantRow`.
#[tauri::command]
pub async fn update_last_read(
    pool: State<'_, SqlitePool>,
    conversation_id: String,
    user_id: String,
) -> Result<ConversationParticipantRow, AppError> {
    let now = now_unix();

    let result = sqlx::query(
        "UPDATE conversation_participants \
         SET last_read_at = ? \
         WHERE conversation_id = ? AND user_id = ?",
    )
    .bind(now)
    .bind(&conversation_id)
    .bind(&user_id)
    .execute(pool.inner())
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found(
            "ConversationParticipant",
            &format!("{conversation_id}/{user_id}"),
        ));
    }

    let row = sqlx::query_as::<_, ConversationParticipantRow>(
        "SELECT * FROM conversation_participants \
         WHERE conversation_id = ? AND user_id = ?",
    )
    .bind(&conversation_id)
    .bind(&user_id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

/// Returns unread message counts for each conversation the user participates in.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `user_id`: The user whose unread counts to compute.
///
/// # Returns
/// A vector of `UnreadCount` with conversation_id and the number of unread
/// messages (where `message.created_at > participant.last_read_at`).
#[tauri::command]
pub async fn get_unread_counts(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<UnreadCount>, AppError> {
    #[derive(sqlx::FromRow)]
    struct RawUnreadCount {
        conversation_id: String,
        count: i64,
    }

    let rows = sqlx::query_as::<_, RawUnreadCount>(
        "SELECT cp.conversation_id, \
                COUNT(m.id) AS count \
         FROM conversation_participants cp \
         LEFT JOIN messages m \
           ON m.conversation_id = cp.conversation_id \
           AND m.created_at > COALESCE(cp.last_read_at, 0) \
           AND m.sender_id != ? \
         WHERE cp.user_id = ? AND cp.left_at IS NULL \
         GROUP BY cp.conversation_id",
    )
    .bind(&user_id)
    .bind(&user_id)
    .fetch_all(pool.inner())
    .await?;

    let counts = rows
        .into_iter()
        .map(|r| UnreadCount {
            conversation_id: r.conversation_id,
            count: r.count,
        })
        .collect();

    Ok(counts)
}

/// Marks a user as having left a conversation by setting `left_at`.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `conversation_id`: The conversation to leave.
/// - `user_id`: The user who is leaving.
///
/// # Returns
/// The updated `ConversationParticipantRow`.
#[tauri::command]
pub async fn leave_conversation(
    pool: State<'_, SqlitePool>,
    conversation_id: String,
    user_id: String,
) -> Result<ConversationParticipantRow, AppError> {
    let now = now_unix();

    let result = sqlx::query(
        "UPDATE conversation_participants \
         SET left_at = ? \
         WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL",
    )
    .bind(now)
    .bind(&conversation_id)
    .bind(&user_id)
    .execute(pool.inner())
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found(
            "ConversationParticipant",
            &format!("{conversation_id}/{user_id}"),
        ));
    }

    let row = sqlx::query_as::<_, ConversationParticipantRow>(
        "SELECT * FROM conversation_participants \
         WHERE conversation_id = ? AND user_id = ?",
    )
    .bind(&conversation_id)
    .bind(&user_id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}

/// Upserts a media attachment for a message using INSERT OR REPLACE.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `input`: Media attachment data.
///
/// # Returns
/// The saved `MediaAttachmentRow`.
#[tauri::command]
pub async fn save_media_attachment(
    pool: State<'_, SqlitePool>,
    input: SaveMediaAttachmentInput,
) -> Result<MediaAttachmentRow, AppError> {
    let valid_providers = ["cloudflare_stream", "supabase_storage"];
    if !valid_providers.contains(&input.provider.as_str()) {
        return Err(AppError::validation(
            "provider",
            &format!(
                "Invalid provider: {}. Valid values: {:?}",
                input.provider, valid_providers
            ),
        ));
    }

    let valid_media_types = ["video", "image", "file"];
    if !valid_media_types.contains(&input.media_type.as_str()) {
        return Err(AppError::validation(
            "media_type",
            &format!(
                "Invalid media_type: {}. Valid values: {:?}",
                input.media_type, valid_media_types
            ),
        ));
    }

    let valid_statuses = ["processing", "ready", "failed"];
    if !valid_statuses.contains(&input.status.as_str()) {
        return Err(AppError::validation(
            "status",
            &format!(
                "Invalid status: {}. Valid values: {:?}",
                input.status, valid_statuses
            ),
        ));
    }

    let id = input
        .id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = now_unix();

    sqlx::query(
        "INSERT OR REPLACE INTO media_attachments \
         (id, message_id, provider, provider_asset_id, media_type, \
          original_filename, mime_type, thumbnail_url, playback_url, \
          duration_seconds, file_size_bytes, status, created_at, updated_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \
                 COALESCE((SELECT created_at FROM media_attachments WHERE id = ?), ?), ?)",
    )
    .bind(&id)
    .bind(&input.message_id)
    .bind(&input.provider)
    .bind(&input.provider_asset_id)
    .bind(&input.media_type)
    .bind(&input.original_filename)
    .bind(&input.mime_type)
    .bind(&input.thumbnail_url)
    .bind(&input.playback_url)
    .bind(input.duration_seconds)
    .bind(input.file_size_bytes)
    .bind(&input.status)
    .bind(&id) // for the COALESCE subquery
    .bind(now) // fallback created_at for new rows
    .bind(now) // updated_at
    .execute(pool.inner())
    .await?;

    let row =
        sqlx::query_as::<_, MediaAttachmentRow>("SELECT * FROM media_attachments WHERE id = ?")
            .bind(&id)
            .fetch_one(pool.inner())
            .await?;

    Ok(row)
}

/// Toggles the `is_archived` flag for a user's conversation participation.
///
/// # Parameters
/// - `pool`: SQLite connection pool (injected by Tauri state).
/// - `conversation_id`: The conversation to toggle archive status for.
/// - `user_id`: The user toggling the archive.
///
/// # Returns
/// The updated `ConversationParticipantRow`.
#[tauri::command]
pub async fn toggle_archive(
    pool: State<'_, SqlitePool>,
    conversation_id: String,
    user_id: String,
) -> Result<ConversationParticipantRow, AppError> {
    // Toggle: 0 -> 1, 1 -> 0 using bitwise NOT via (1 - is_archived)
    let result = sqlx::query(
        "UPDATE conversation_participants \
         SET is_archived = (1 - is_archived) \
         WHERE conversation_id = ? AND user_id = ?",
    )
    .bind(&conversation_id)
    .bind(&user_id)
    .execute(pool.inner())
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found(
            "ConversationParticipant",
            &format!("{conversation_id}/{user_id}"),
        ));
    }

    let row = sqlx::query_as::<_, ConversationParticipantRow>(
        "SELECT * FROM conversation_participants \
         WHERE conversation_id = ? AND user_id = ?",
    )
    .bind(&conversation_id)
    .bind(&user_id)
    .fetch_one(pool.inner())
    .await?;

    Ok(row)
}
