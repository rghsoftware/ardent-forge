use serde::{Deserialize, Serialize};

// ============================================================
// Row structs -- mirror SQLite tables 1:1
// Timestamps serialize as ISO 8601 strings via serde_unix.
// ============================================================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ExerciseRow {
    pub id: String,
    pub name: String,
    pub aliases: Option<String>, // JSON array
    pub category: String,
    pub movement_pattern: Option<String>,
    pub muscle_groups: Option<String>,      // JSON array
    pub is_bilateral: Option<i32>,          // boolean 0/1
    pub supports_1rm: Option<i32>,          // boolean 0/1
    pub equipment_required: Option<String>, // JSON array
    pub is_custom: Option<i32>,             // boolean, default 0
    pub is_public: Option<i32>,             // boolean, default 0
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct WorkoutLogRow {
    pub id: String,
    pub user_id: Option<String>,
    pub title: Option<String>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_required")]
    pub started_at: i64,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub completed_at: Option<i64>,
    pub session_template_id: Option<String>,
    pub program_context: Option<String>, // JSON
    pub overall_notes: Option<String>,
    pub perceived_difficulty: Option<i32>,     // 1-10
    pub bodyweight_at_session: Option<String>, // JSON Weight
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LoggedActivityGroupRow {
    pub id: String,
    pub workout_log_id: String,
    pub user_id: Option<String>,
    pub group_type: String,
    pub ordinal: i32,
    pub actual_rounds_completed: Option<i32>,
    pub completion_time: Option<String>, // JSON Duration
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LoggedActivityRow {
    pub id: String,
    pub logged_group_id: String,
    pub user_id: Option<String>,
    pub exercise_id: String,
    pub ordinal: i32,
    pub notes: Option<String>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LoggedSetRow {
    pub id: String,
    pub logged_activity_id: String,
    pub user_id: Option<String>,
    pub set_number: i32,
    pub set_type: String,
    pub prescribed: Option<String>, // JSON
    pub actual_reps: Option<i32>,
    pub actual_weight: Option<String>,   // JSON Weight
    pub actual_duration: Option<String>, // JSON Duration
    pub actual_distance: Option<String>, // JSON Distance
    pub actual_pace: Option<String>,     // JSON Pace
    pub actual_heart_rate: Option<i32>,
    pub ruck_load: Option<String>,      // JSON Weight
    pub elevation_gain: Option<String>, // JSON Distance
    pub rpe: Option<i32>,               // 1-10
    pub completed: Option<i32>,         // boolean 0/1
    pub notes: Option<String>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct UserProfileRow {
    pub id: String,
    pub display_name: Option<String>,
    pub preferred_units: Option<String>, // default IMPERIAL
    pub bodyweight: Option<String>,      // JSON Weight
    pub training_age: Option<String>,    // JSON Duration
    pub exercise_maxes: Option<String>,  // JSON map
    pub max_reps: Option<String>,        // JSON map
    pub display_visible: Option<i32>,    // boolean 0/1, default 1
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct OneRepMaxHistoryRow {
    pub id: String,
    pub user_id: String,
    pub exercise_id: String,
    pub weight: String,         // JSON Weight (NOT NULL)
    pub estimated: Option<i32>, // boolean 0/1
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_required")]
    pub recorded_at: i64,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
}

// ============================================================
// Composite / summary structs for Tauri commands
// ============================================================

/// Summary view for workout history list.
/// Returned by get_workout_logs_summary -- includes aggregated counts.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutLogSummary {
    pub log: WorkoutLogRow,
    pub exercise_names: Vec<String>,
    pub set_count: i64,
    pub exercise_count: i64,
}

/// Full nested workout log for detail view.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutLogFull {
    pub log: WorkoutLogRow,
    pub groups: Vec<LoggedActivityGroupRow>,
    pub activities: Vec<LoggedActivityRow>,
    pub sets: Vec<LoggedSetRow>,
}

/// Workout log with its sets for a specific exercise (exercise history).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutWithSets {
    pub log: WorkoutLogRow,
    pub sets: Vec<LoggedSetRow>,
}

// ============================================================
// Session template row structs -- mirror SQLite tables 1:1
// ============================================================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct SessionTemplateRow {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub rest_between_groups: Option<String>, // JSON Duration
    pub time_cap: Option<String>,            // JSON Duration
    pub scoring: String,
    pub is_public: i64,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub last_assigned_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub last_assigned_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ActivityGroupRow {
    pub id: String,
    pub session_template_id: String,
    pub group_type: String,
    pub ordinal: i32,
    pub rounds: Option<i32>,
    pub rest_between_rounds: Option<String>,
    pub rest_between_activities: Option<String>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ActivityRow {
    pub id: String,
    pub activity_group_id: String,
    pub exercise_id: String,
    pub ordinal: i32,
    pub set_scheme: String, // JSON SetScheme
    pub notes: Option<String>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

// ============================================================
// Session template composite structs
// ============================================================

/// Full nested session template for detail/editor view.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionTemplateFull {
    pub template: SessionTemplateRow,
    pub groups: Vec<ActivityGroupRow>,
    pub activities: Vec<ActivityRow>,
}

// ============================================================
// Program row structs -- mirror SQLite tables 1:1
// ============================================================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ProgramRow {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub source: String,
    pub duration_weeks: Option<i64>,
    pub is_public: i64,
    pub created_by: Option<String>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct BlockRow {
    pub id: String,
    pub program_id: String,
    pub name: String,
    pub ordinal: i64,
    pub duration_weeks: i64,
    pub block_type: String,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct BlockWeekRow {
    pub id: String,
    pub block_id: String,
    pub week_number: i64,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ScheduledSessionRow {
    pub id: String,
    pub block_week_id: String,
    pub day_of_week: Option<i64>,
    pub day_label: String,
    pub session_type: String,
    pub session_template_id: String,
    pub notes: Option<String>,
    pub overrides: Option<String>, // JSON per-instance activity overrides
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ProgramActivationRow {
    pub id: String,
    pub user_id: String,
    pub program_id: String,
    pub current_block_ordinal: i64,
    pub current_week_number: i64,
    pub start_date: String,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ProgramWeekStatusRow {
    pub id: String,
    pub activation_id: String,
    pub block_ordinal: i64,
    pub week_number: i64,
    pub status: String,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
}

// ============================================================
// Program composite structs
// ============================================================

/// Full nested program for detail/editor view.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgramFull {
    pub program: ProgramRow,
    pub blocks: Vec<BlockRow>,
    pub block_weeks: Vec<BlockWeekRow>,
    pub scheduled_sessions: Vec<ScheduledSessionRow>,
}

// ============================================================
// Sharing row structs -- mirror SQLite tables 1:1
// ============================================================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct AccountabilityGroupRow {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub data_retention_days: i64,
    pub created_by: String,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct GroupMemberRow {
    pub id: String,
    pub group_id: String,
    pub user_id: String,
    pub role: String,
    pub share_history_before_join: i64, // boolean 0/1
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub joined_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct GroupInviteRow {
    pub id: String,
    pub group_id: String,
    pub code: String,
    pub created_by: String,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_required")]
    pub expires_at: i64,
    pub is_active: i64, // boolean 0/1
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct DirectConnectionRow {
    pub id: String,
    pub requester_id: String,
    pub recipient_id: String,
    pub status: String,
    pub requester_grants_write: i64, // boolean 0/1
    pub recipient_grants_write: i64, // boolean 0/1
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub accepted_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub created_at: Option<i64>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub updated_at: Option<i64>,
}

// ============================================================
// Sharing composite / feed structs
// ============================================================

/// Activity feed entry for group workout visibility.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GroupActivityFeedEntry {
    pub id: String,
    pub user_id: String,
    pub title: Option<String>,
    pub started_at: String,           // ISO 8601
    pub completed_at: Option<String>, // ISO 8601
    pub duration_seconds: Option<i64>,
    pub exercise_count: i64,
    pub group_id: String,
    pub member_role: String,
}

/// Activity feed entry for connection workout visibility.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConnectionActivityFeedEntry {
    pub id: String,
    pub user_id: String,
    pub title: Option<String>,
    pub started_at: String,           // ISO 8601
    pub completed_at: Option<String>, // ISO 8601
    pub duration_seconds: Option<i64>,
    pub exercise_count: i64,
    pub connection_id: String,
}

// ============================================================
// Chat row structs -- mirror SQLite tables 1:1
// ============================================================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ConversationRow {
    pub id: String,
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub type_: String,
    pub title: Option<String>,
    pub group_id: Option<String>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_required")]
    pub created_at: i64,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_required")]
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ConversationParticipantRow {
    pub id: String,
    pub conversation_id: String,
    pub user_id: String,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub last_read_at: Option<i64>,
    pub is_archived: i64, // boolean 0/1
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_required")]
    pub joined_at: i64,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_optional")]
    pub left_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MessageRow {
    pub id: String,
    pub conversation_id: String,
    pub sender_id: Option<String>,
    pub message_type: String,
    pub content: Option<String>,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_required")]
    pub created_at: i64,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_required")]
    pub updated_at: i64,
    pub sync_status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct MediaAttachmentRow {
    pub id: String,
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
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_required")]
    pub created_at: i64,
    #[serde(serialize_with = "crate::utils::serde_unix::serialize_required")]
    pub updated_at: i64,
}
