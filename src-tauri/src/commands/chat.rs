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
// Commands (thin wrappers delegating to inner functions for testability)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn create_conversation(
    pool: State<'_, SqlitePool>,
    input: CreateConversationInput,
) -> Result<ConversationWithParticipants, AppError> {
    create_conversation_inner(pool.inner(), input).await
}

#[tauri::command]
pub async fn get_conversations(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<ConversationWithParticipants>, AppError> {
    get_conversations_inner(pool.inner(), user_id).await
}

#[tauri::command]
pub async fn get_conversation(
    pool: State<'_, SqlitePool>,
    id: String,
) -> Result<Option<ConversationWithParticipants>, AppError> {
    get_conversation_inner(pool.inner(), id).await
}

#[tauri::command]
pub async fn send_message(
    pool: State<'_, SqlitePool>,
    input: SendMessageInput,
) -> Result<MessageRow, AppError> {
    send_message_inner(pool.inner(), input).await
}

#[tauri::command]
pub async fn get_messages_since(
    pool: State<'_, SqlitePool>,
    conversation_id: String,
    since: i64,
) -> Result<Vec<MessageRow>, AppError> {
    get_messages_since_inner(pool.inner(), conversation_id, since).await
}

#[tauri::command]
pub async fn get_messages(
    pool: State<'_, SqlitePool>,
    conversation_id: String,
    before: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<MessageRow>, AppError> {
    get_messages_inner(pool.inner(), conversation_id, before, limit).await
}

#[tauri::command]
pub async fn update_last_read(
    pool: State<'_, SqlitePool>,
    conversation_id: String,
    user_id: String,
) -> Result<ConversationParticipantRow, AppError> {
    update_last_read_inner(pool.inner(), conversation_id, user_id).await
}

#[tauri::command]
pub async fn get_unread_counts(
    pool: State<'_, SqlitePool>,
    user_id: String,
) -> Result<Vec<UnreadCount>, AppError> {
    get_unread_counts_inner(pool.inner(), user_id).await
}

#[tauri::command]
pub async fn leave_conversation(
    pool: State<'_, SqlitePool>,
    conversation_id: String,
    user_id: String,
) -> Result<ConversationParticipantRow, AppError> {
    leave_conversation_inner(pool.inner(), conversation_id, user_id).await
}

#[tauri::command]
pub async fn save_media_attachment(
    pool: State<'_, SqlitePool>,
    input: SaveMediaAttachmentInput,
) -> Result<MediaAttachmentRow, AppError> {
    save_media_attachment_inner(pool.inner(), input).await
}

#[tauri::command]
pub async fn get_media_attachments(
    pool: State<'_, SqlitePool>,
    message_ids: Vec<String>,
) -> Result<Vec<MediaAttachmentRow>, AppError> {
    get_media_attachments_inner(pool.inner(), message_ids).await
}

#[tauri::command]
pub async fn toggle_archive(
    pool: State<'_, SqlitePool>,
    conversation_id: String,
    user_id: String,
) -> Result<ConversationParticipantRow, AppError> {
    toggle_archive_inner(pool.inner(), conversation_id, user_id).await
}

// ---------------------------------------------------------------------------
// Inner functions (testable, take &SqlitePool directly)
// ---------------------------------------------------------------------------

pub(crate) async fn create_conversation_inner(
    pool: &SqlitePool,
    input: CreateConversationInput,
) -> Result<ConversationWithParticipants, AppError> {
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

    if input.conversation_type == "direct" && input.participant_user_ids.len() != 2 {
        return Err(AppError::validation(
            "participant_user_ids",
            "Direct conversations require exactly 2 participants",
        ));
    }

    let conversation_id = Uuid::new_v4().to_string();
    let now = now_unix();

    let mut tx = pool.begin().await?;

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

pub(crate) async fn get_conversations_inner(
    pool: &SqlitePool,
    user_id: String,
) -> Result<Vec<ConversationWithParticipants>, AppError> {
    let conversations = sqlx::query_as::<_, ConversationRow>(
        "SELECT c.id, c.\"type\", c.title, c.group_id, c.created_at, c.updated_at \
         FROM conversations c \
         JOIN conversation_participants cp ON cp.conversation_id = c.id \
         WHERE cp.user_id = ? AND cp.left_at IS NULL \
         ORDER BY c.updated_at DESC",
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await?;

    if conversations.is_empty() {
        return Ok(Vec::new());
    }

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
    let all_participants = query.fetch_all(pool).await?;

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

pub(crate) async fn get_conversation_inner(
    pool: &SqlitePool,
    id: String,
) -> Result<Option<ConversationWithParticipants>, AppError> {
    let conversation = sqlx::query_as::<_, ConversationRow>(
        "SELECT id, \"type\", title, group_id, created_at, updated_at \
         FROM conversations WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(pool)
    .await?;

    let conversation = match conversation {
        Some(c) => c,
        None => return Ok(None),
    };

    let participants = sqlx::query_as::<_, ConversationParticipantRow>(
        "SELECT * FROM conversation_participants WHERE conversation_id = ?",
    )
    .bind(&id)
    .fetch_all(pool)
    .await?;

    Ok(Some(ConversationWithParticipants {
        conversation,
        participants,
    }))
}

pub(crate) async fn send_message_inner(
    pool: &SqlitePool,
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

    if let Some(ref sender) = input.sender_id {
        let participant: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM conversation_participants \
             WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL",
        )
        .bind(&input.conversation_id)
        .bind(sender)
        .fetch_optional(pool)
        .await?;

        if participant.is_none() {
            return Err(AppError::validation(
                "sender_id",
                "Sender is not an active participant in this conversation",
            ));
        }
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

pub(crate) async fn get_messages_since_inner(
    pool: &SqlitePool,
    conversation_id: String,
    since: i64,
) -> Result<Vec<MessageRow>, AppError> {
    let rows = sqlx::query_as::<_, MessageRow>(
        "SELECT * FROM messages \
         WHERE conversation_id = ? AND created_at > ? \
         ORDER BY created_at ASC",
    )
    .bind(&conversation_id)
    .bind(since)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub(crate) async fn get_messages_inner(
    pool: &SqlitePool,
    conversation_id: String,
    before: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<MessageRow>, AppError> {
    let lim = limit.unwrap_or(50);

    let mut rows = if let Some(before_ts) = before {
        sqlx::query_as::<_, MessageRow>(
            "SELECT * FROM messages \
             WHERE conversation_id = ? AND created_at < ? \
             ORDER BY created_at DESC \
             LIMIT ?",
        )
        .bind(&conversation_id)
        .bind(before_ts)
        .bind(lim)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, MessageRow>(
            "SELECT * FROM messages \
             WHERE conversation_id = ? \
             ORDER BY created_at DESC \
             LIMIT ?",
        )
        .bind(&conversation_id)
        .bind(lim)
        .fetch_all(pool)
        .await?
    };

    rows.reverse();
    Ok(rows)
}

pub(crate) async fn update_last_read_inner(
    pool: &SqlitePool,
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
    .execute(pool)
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
    .fetch_one(pool)
    .await?;

    Ok(row)
}

pub(crate) async fn get_unread_counts_inner(
    pool: &SqlitePool,
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
    .fetch_all(pool)
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

pub(crate) async fn leave_conversation_inner(
    pool: &SqlitePool,
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
    .execute(pool)
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
    .fetch_one(pool)
    .await?;

    Ok(row)
}

pub(crate) async fn save_media_attachment_inner(
    pool: &SqlitePool,
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
    .bind(&id)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;

    let row =
        sqlx::query_as::<_, MediaAttachmentRow>("SELECT * FROM media_attachments WHERE id = ?")
            .bind(&id)
            .fetch_one(pool)
            .await?;

    Ok(row)
}

pub(crate) async fn get_media_attachments_inner(
    pool: &SqlitePool,
    message_ids: Vec<String>,
) -> Result<Vec<MediaAttachmentRow>, AppError> {
    if message_ids.is_empty() {
        return Ok(Vec::new());
    }

    let placeholders = message_ids
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!("SELECT * FROM media_attachments WHERE message_id IN ({placeholders})");
    let mut query = sqlx::query_as::<_, MediaAttachmentRow>(&sql);
    for mid in &message_ids {
        query = query.bind(mid);
    }
    let rows = query.fetch_all(pool).await?;

    Ok(rows)
}

pub(crate) async fn toggle_archive_inner(
    pool: &SqlitePool,
    conversation_id: String,
    user_id: String,
) -> Result<ConversationParticipantRow, AppError> {
    let result = sqlx::query(
        "UPDATE conversation_participants \
         SET is_archived = (1 - is_archived) \
         WHERE conversation_id = ? AND user_id = ?",
    )
    .bind(&conversation_id)
    .bind(&user_id)
    .execute(pool)
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
    .fetch_one(pool)
    .await?;

    Ok(row)
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    const CHAT_DDL: &str = "\
        CREATE TABLE IF NOT EXISTS conversations (\
            id TEXT PRIMARY KEY, \
            type TEXT NOT NULL CHECK(type IN ('direct', 'group')), \
            title TEXT, \
            group_id TEXT, \
            created_at INTEGER NOT NULL, \
            updated_at INTEGER NOT NULL\
        );\
        CREATE TABLE IF NOT EXISTS conversation_participants (\
            id TEXT PRIMARY KEY, \
            conversation_id TEXT NOT NULL, \
            user_id TEXT NOT NULL, \
            last_read_at INTEGER, \
            is_archived INTEGER NOT NULL DEFAULT 0, \
            joined_at INTEGER NOT NULL, \
            left_at INTEGER, \
            UNIQUE (conversation_id, user_id)\
        );\
        CREATE TABLE IF NOT EXISTS messages (\
            id TEXT PRIMARY KEY, \
            conversation_id TEXT NOT NULL, \
            sender_id TEXT, \
            message_type TEXT NOT NULL CHECK(message_type IN ('text', 'workout', 'media', 'file', 'system')), \
            content TEXT, \
            created_at INTEGER NOT NULL, \
            updated_at INTEGER NOT NULL, \
            sync_status TEXT NOT NULL DEFAULT 'synced' CHECK(sync_status IN ('pending', 'synced', 'failed'))\
        );\
        CREATE TABLE IF NOT EXISTS media_attachments (\
            id TEXT PRIMARY KEY, \
            message_id TEXT NOT NULL, \
            provider TEXT NOT NULL CHECK(provider IN ('cloudflare_stream', 'supabase_storage')), \
            provider_asset_id TEXT, \
            media_type TEXT NOT NULL CHECK(media_type IN ('video', 'image', 'file')), \
            original_filename TEXT, \
            mime_type TEXT, \
            thumbnail_url TEXT, \
            playback_url TEXT, \
            duration_seconds INTEGER, \
            file_size_bytes INTEGER, \
            status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'ready', 'failed')), \
            created_at INTEGER NOT NULL, \
            updated_at INTEGER NOT NULL\
        );";

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .expect("in-memory pool");

        for stmt in CHAT_DDL.split(';') {
            let trimmed = stmt.trim();
            if !trimmed.is_empty() {
                sqlx::query(trimmed)
                    .execute(&pool)
                    .await
                    .unwrap_or_else(|e| panic!("DDL failed: {e}\nSQL: {trimmed}"));
            }
        }

        pool
    }

    /// Seeds a direct conversation between user-a and user-b, returns the conversation ID.
    async fn seed_direct_conversation(pool: &SqlitePool) -> String {
        let result = create_conversation_inner(
            pool,
            CreateConversationInput {
                conversation_type: "direct".into(),
                title: None,
                group_id: None,
                participant_user_ids: vec!["user-a".into(), "user-b".into()],
            },
        )
        .await
        .expect("seed conversation");
        result.conversation.id
    }

    // -----------------------------------------------------------------------
    // create_conversation
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn create_direct_conversation() {
        let pool = setup_test_db().await;

        let result = create_conversation_inner(
            &pool,
            CreateConversationInput {
                conversation_type: "direct".into(),
                title: None,
                group_id: None,
                participant_user_ids: vec!["user-a".into(), "user-b".into()],
            },
        )
        .await
        .unwrap();

        assert_eq!(result.conversation.type_, "direct");
        assert_eq!(result.participants.len(), 2);
    }

    #[tokio::test]
    async fn create_group_conversation_with_title() {
        let pool = setup_test_db().await;

        let result = create_conversation_inner(
            &pool,
            CreateConversationInput {
                conversation_type: "group".into(),
                title: Some("Workout Crew".into()),
                group_id: Some("grp-001".into()),
                participant_user_ids: vec!["user-a".into(), "user-b".into(), "user-c".into()],
            },
        )
        .await
        .unwrap();

        assert_eq!(result.conversation.type_, "group");
        assert_eq!(result.conversation.title, Some("Workout Crew".into()));
        assert_eq!(result.conversation.group_id, Some("grp-001".into()));
        assert_eq!(result.participants.len(), 3);
    }

    #[tokio::test]
    async fn create_conversation_rejects_empty_participants() {
        let pool = setup_test_db().await;

        let err = create_conversation_inner(
            &pool,
            CreateConversationInput {
                conversation_type: "direct".into(),
                title: None,
                group_id: None,
                participant_user_ids: vec![],
            },
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("At least one participant"));
    }

    #[tokio::test]
    async fn create_conversation_rejects_invalid_type() {
        let pool = setup_test_db().await;

        let err = create_conversation_inner(
            &pool,
            CreateConversationInput {
                conversation_type: "channel".into(),
                title: None,
                group_id: None,
                participant_user_ids: vec!["user-a".into()],
            },
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("Invalid conversation_type"));
    }

    #[tokio::test]
    async fn create_direct_rejects_wrong_participant_count() {
        let pool = setup_test_db().await;

        let err = create_conversation_inner(
            &pool,
            CreateConversationInput {
                conversation_type: "direct".into(),
                title: None,
                group_id: None,
                participant_user_ids: vec!["user-a".into()],
            },
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("exactly 2 participants"));
    }

    // -----------------------------------------------------------------------
    // get_conversations
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_conversations_returns_user_conversations() {
        let pool = setup_test_db().await;
        seed_direct_conversation(&pool).await;

        let result = get_conversations_inner(&pool, "user-a".into())
            .await
            .unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].participants.len(), 2);
    }

    #[tokio::test]
    async fn get_conversations_returns_empty_for_unknown_user() {
        let pool = setup_test_db().await;

        let result = get_conversations_inner(&pool, "unknown".into())
            .await
            .unwrap();

        assert!(result.is_empty());
    }

    // -----------------------------------------------------------------------
    // get_conversation
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_conversation_returns_some() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        let result = get_conversation_inner(&pool, conv_id).await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().participants.len(), 2);
    }

    #[tokio::test]
    async fn get_conversation_returns_none_for_missing() {
        let pool = setup_test_db().await;

        let result = get_conversation_inner(&pool, "nonexistent".into())
            .await
            .unwrap();

        assert!(result.is_none());
    }

    // -----------------------------------------------------------------------
    // send_message
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn send_message_creates_pending_message() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        let msg = send_message_inner(
            &pool,
            SendMessageInput {
                conversation_id: conv_id,
                sender_id: Some("user-a".into()),
                message_type: "text".into(),
                content: Some("Hello!".into()),
            },
        )
        .await
        .unwrap();

        assert_eq!(msg.message_type, "text");
        assert_eq!(msg.content, Some("Hello!".into()));
        assert_eq!(msg.sync_status, Some("pending".into()));
    }

    #[tokio::test]
    async fn send_message_rejects_invalid_type() {
        let pool = setup_test_db().await;

        let err = send_message_inner(
            &pool,
            SendMessageInput {
                conversation_id: "conv-1".into(),
                sender_id: None,
                message_type: "gif".into(),
                content: None,
            },
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("Invalid message_type"));
    }

    #[tokio::test]
    async fn send_message_rejects_non_participant_sender() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        let err = send_message_inner(
            &pool,
            SendMessageInput {
                conversation_id: conv_id,
                sender_id: Some("outsider".into()),
                message_type: "text".into(),
                content: Some("Sneaky".into()),
            },
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("not an active participant"));
    }

    // -----------------------------------------------------------------------
    // get_messages / get_messages_since
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_messages_returns_ascending_order() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        // Insert two messages with different timestamps
        for (i, ts) in [100i64, 200].iter().enumerate() {
            sqlx::query(
                "INSERT INTO messages (id, conversation_id, sender_id, message_type, content, created_at, updated_at, sync_status) \
                 VALUES (?, ?, 'user-a', 'text', ?, ?, ?, 'synced')"
            )
            .bind(format!("msg-{i}"))
            .bind(&conv_id)
            .bind(format!("Message {i}"))
            .bind(ts)
            .bind(ts)
            .execute(&pool).await.unwrap();
        }

        let msgs = get_messages_inner(&pool, conv_id, None, Some(10))
            .await
            .unwrap();

        assert_eq!(msgs.len(), 2);
        assert!(msgs[0].created_at < msgs[1].created_at);
    }

    #[tokio::test]
    async fn get_messages_cursor_pagination() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        for (i, ts) in [100i64, 200, 300].iter().enumerate() {
            sqlx::query(
                "INSERT INTO messages (id, conversation_id, sender_id, message_type, content, created_at, updated_at, sync_status) \
                 VALUES (?, ?, 'user-a', 'text', ?, ?, ?, 'synced')"
            )
            .bind(format!("msg-{i}"))
            .bind(&conv_id)
            .bind(format!("Message {i}"))
            .bind(ts)
            .bind(ts)
            .execute(&pool).await.unwrap();
        }

        let msgs = get_messages_inner(&pool, conv_id, Some(300), Some(10))
            .await
            .unwrap();

        assert_eq!(msgs.len(), 2);
        assert!(msgs.iter().all(|m| m.created_at < 300));
    }

    #[tokio::test]
    async fn get_messages_since_filters_by_timestamp() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        for (i, ts) in [100i64, 200, 300].iter().enumerate() {
            sqlx::query(
                "INSERT INTO messages (id, conversation_id, sender_id, message_type, content, created_at, updated_at, sync_status) \
                 VALUES (?, ?, 'user-a', 'text', ?, ?, ?, 'synced')"
            )
            .bind(format!("msg-{i}"))
            .bind(&conv_id)
            .bind(format!("Message {i}"))
            .bind(ts)
            .bind(ts)
            .execute(&pool).await.unwrap();
        }

        let msgs = get_messages_since_inner(&pool, conv_id, 150).await.unwrap();

        assert_eq!(msgs.len(), 2);
        assert!(msgs.iter().all(|m| m.created_at > 150));
    }

    // -----------------------------------------------------------------------
    // update_last_read
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn update_last_read_sets_timestamp() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        let row = update_last_read_inner(&pool, conv_id, "user-a".into())
            .await
            .unwrap();

        assert!(row.last_read_at.is_some());
    }

    #[tokio::test]
    async fn update_last_read_returns_not_found() {
        let pool = setup_test_db().await;

        let err = update_last_read_inner(&pool, "nonexistent".into(), "user-a".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("not found"));
    }

    // -----------------------------------------------------------------------
    // get_unread_counts
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn get_unread_counts_counts_unread_messages() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        // Mark user-a's last_read_at to 100
        sqlx::query(
            "UPDATE conversation_participants SET last_read_at = 100 \
             WHERE conversation_id = ? AND user_id = 'user-a'",
        )
        .bind(&conv_id)
        .execute(&pool)
        .await
        .unwrap();

        // Insert a message from user-b at timestamp 200 (after last_read_at)
        sqlx::query(
            "INSERT INTO messages (id, conversation_id, sender_id, message_type, content, created_at, updated_at, sync_status) \
             VALUES ('msg-unread', ?, 'user-b', 'text', 'Hey', 200, 200, 'synced')"
        )
        .bind(&conv_id)
        .execute(&pool).await.unwrap();

        let counts = get_unread_counts_inner(&pool, "user-a".into())
            .await
            .unwrap();

        assert_eq!(counts.len(), 1);
        assert_eq!(counts[0].count, 1);
    }

    #[tokio::test]
    async fn get_unread_counts_excludes_own_messages() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        sqlx::query(
            "UPDATE conversation_participants SET last_read_at = 100 \
             WHERE conversation_id = ? AND user_id = 'user-a'",
        )
        .bind(&conv_id)
        .execute(&pool)
        .await
        .unwrap();

        // Message from user-a (self) should not count as unread
        sqlx::query(
            "INSERT INTO messages (id, conversation_id, sender_id, message_type, content, created_at, updated_at, sync_status) \
             VALUES ('msg-own', ?, 'user-a', 'text', 'My msg', 200, 200, 'synced')"
        )
        .bind(&conv_id)
        .execute(&pool).await.unwrap();

        let counts = get_unread_counts_inner(&pool, "user-a".into())
            .await
            .unwrap();

        assert_eq!(counts.len(), 1);
        assert_eq!(counts[0].count, 0);
    }

    // -----------------------------------------------------------------------
    // leave_conversation
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn leave_conversation_sets_left_at() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        let row = leave_conversation_inner(&pool, conv_id.clone(), "user-a".into())
            .await
            .unwrap();

        assert!(row.left_at.is_some());

        // User should no longer appear in get_conversations
        let convs = get_conversations_inner(&pool, "user-a".into())
            .await
            .unwrap();
        assert!(convs.is_empty());
    }

    #[tokio::test]
    async fn leave_conversation_returns_not_found_if_already_left() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        // Leave once
        leave_conversation_inner(&pool, conv_id.clone(), "user-a".into())
            .await
            .unwrap();

        // Try to leave again
        let err = leave_conversation_inner(&pool, conv_id, "user-a".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("not found"));
    }

    // -----------------------------------------------------------------------
    // toggle_archive
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn toggle_archive_flips_flag() {
        let pool = setup_test_db().await;
        let conv_id = seed_direct_conversation(&pool).await;

        // Initially not archived (0)
        let row = toggle_archive_inner(&pool, conv_id.clone(), "user-a".into())
            .await
            .unwrap();
        assert_eq!(row.is_archived, 1);

        // Toggle again
        let row = toggle_archive_inner(&pool, conv_id, "user-a".into())
            .await
            .unwrap();
        assert_eq!(row.is_archived, 0);
    }

    #[tokio::test]
    async fn toggle_archive_returns_not_found() {
        let pool = setup_test_db().await;

        let err = toggle_archive_inner(&pool, "nonexistent".into(), "user-a".into())
            .await
            .unwrap_err();

        assert!(err.message.contains("not found"));
    }

    // -----------------------------------------------------------------------
    // save_media_attachment / get_media_attachments
    // -----------------------------------------------------------------------

    #[tokio::test]
    async fn save_and_get_media_attachment() {
        let pool = setup_test_db().await;

        let saved = save_media_attachment_inner(
            &pool,
            SaveMediaAttachmentInput {
                id: Some("ma-001".into()),
                message_id: "msg-001".into(),
                provider: "cloudflare_stream".into(),
                provider_asset_id: Some("asset-1".into()),
                media_type: "video".into(),
                original_filename: Some("workout.mp4".into()),
                mime_type: Some("video/mp4".into()),
                thumbnail_url: None,
                playback_url: None,
                duration_seconds: Some(120),
                file_size_bytes: Some(5_000_000),
                status: "ready".into(),
            },
        )
        .await
        .unwrap();

        assert_eq!(saved.id, "ma-001");
        assert_eq!(saved.provider, "cloudflare_stream");
        assert_eq!(saved.status, "ready");

        let attachments = get_media_attachments_inner(&pool, vec!["msg-001".into()])
            .await
            .unwrap();
        assert_eq!(attachments.len(), 1);
        assert_eq!(attachments[0].id, "ma-001");
    }

    #[tokio::test]
    async fn save_media_attachment_rejects_invalid_provider() {
        let pool = setup_test_db().await;

        let err = save_media_attachment_inner(
            &pool,
            SaveMediaAttachmentInput {
                id: None,
                message_id: "msg-001".into(),
                provider: "youtube".into(),
                provider_asset_id: None,
                media_type: "video".into(),
                original_filename: None,
                mime_type: None,
                thumbnail_url: None,
                playback_url: None,
                duration_seconds: None,
                file_size_bytes: None,
                status: "processing".into(),
            },
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("Invalid provider"));
    }

    #[tokio::test]
    async fn save_media_attachment_rejects_invalid_status() {
        let pool = setup_test_db().await;

        let err = save_media_attachment_inner(
            &pool,
            SaveMediaAttachmentInput {
                id: None,
                message_id: "msg-001".into(),
                provider: "cloudflare_stream".into(),
                provider_asset_id: None,
                media_type: "video".into(),
                original_filename: None,
                mime_type: None,
                thumbnail_url: None,
                playback_url: None,
                duration_seconds: None,
                file_size_bytes: None,
                status: "pending".into(),
            },
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("Invalid status"));
    }

    #[tokio::test]
    async fn get_media_attachments_returns_empty_for_empty_ids() {
        let pool = setup_test_db().await;

        let result = get_media_attachments_inner(&pool, vec![]).await.unwrap();

        assert!(result.is_empty());
    }
}
