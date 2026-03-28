use serde::{Deserialize, Serialize};

// ============================================================
// Row structs -- mirror SQLite tables 1:1
// Timestamps serialize as ISO 8601 strings via serde_unix.
// ============================================================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ExerciseRow {
    pub id: String,
    pub name: String,
    pub aliases: Option<String>,           // JSON array
    pub category: String,
    pub movement_pattern: Option<String>,
    pub muscle_groups: Option<String>,     // JSON array
    pub is_bilateral: Option<i32>,         // boolean 0/1
    pub supports_1rm: Option<i32>,         // boolean 0/1
    pub equipment_required: Option<String>, // JSON array
    pub is_custom: Option<i32>,            // boolean, default 0
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
    pub program_context: Option<String>,       // JSON
    pub overall_notes: Option<String>,
    pub perceived_difficulty: Option<i32>,      // 1-10
    pub bodyweight_at_session: Option<String>,  // JSON Weight
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
    pub completion_time: Option<String>,  // JSON Duration
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
    pub prescribed: Option<String>,         // JSON
    pub actual_reps: Option<i32>,
    pub actual_weight: Option<String>,      // JSON Weight
    pub actual_duration: Option<String>,    // JSON Duration
    pub actual_distance: Option<String>,    // JSON Distance
    pub actual_pace: Option<String>,        // JSON Pace
    pub actual_heart_rate: Option<i32>,
    pub ruck_load: Option<String>,          // JSON Weight
    pub elevation_gain: Option<String>,     // JSON Distance
    pub rpe: Option<i32>,                   // 1-10
    pub completed: Option<i32>,             // boolean 0/1
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
    pub preferred_units: Option<String>,    // default IMPERIAL
    pub bodyweight: Option<String>,         // JSON Weight
    pub training_age: Option<String>,       // JSON Duration
    pub exercise_maxes: Option<String>,     // JSON map
    pub max_reps: Option<String>,           // JSON map
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
    pub weight: String,                     // JSON Weight (NOT NULL)
    pub estimated: Option<i32>,             // boolean 0/1
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
