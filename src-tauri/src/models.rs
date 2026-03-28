use serde::{Deserialize, Serialize};

// ============================================================
// Row structs -- mirror SQLite tables 1:1
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
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct WorkoutLogRow {
    pub id: String,
    pub user_id: Option<String>,
    pub title: Option<String>,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub session_template_id: Option<String>,
    pub program_context: Option<String>,       // JSON
    pub overall_notes: Option<String>,
    pub perceived_difficulty: Option<i32>,      // 1-10
    pub bodyweight_at_session: Option<String>,  // JSON Weight
    pub created_at: Option<i64>,
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
    pub created_at: Option<i64>,
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
    pub created_at: Option<i64>,
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
    pub created_at: Option<i64>,
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
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct OneRepMaxHistoryRow {
    pub id: String,
    pub user_id: String,
    pub exercise_id: String,
    pub weight: String,                     // JSON Weight (NOT NULL)
    pub estimated: Option<i32>,             // boolean 0/1
    pub recorded_at: i64,
    pub created_at: Option<i64>,
}

// ============================================================
// Response structs -- timestamps as ISO 8601 strings for TS
// ============================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExerciseResponse {
    pub id: String,
    pub name: String,
    pub aliases: Option<String>,
    pub category: String,
    pub movement_pattern: Option<String>,
    pub muscle_groups: Option<String>,
    pub is_bilateral: Option<i32>,
    pub supports_1rm: Option<i32>,
    pub equipment_required: Option<String>,
    pub is_custom: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutLogResponse {
    pub id: String,
    pub user_id: Option<String>,
    pub title: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub session_template_id: Option<String>,
    pub program_context: Option<String>,
    pub overall_notes: Option<String>,
    pub perceived_difficulty: Option<i32>,
    pub bodyweight_at_session: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoggedActivityGroupResponse {
    pub id: String,
    pub workout_log_id: String,
    pub user_id: Option<String>,
    pub group_type: String,
    pub ordinal: i32,
    pub actual_rounds_completed: Option<i32>,
    pub completion_time: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoggedActivityResponse {
    pub id: String,
    pub logged_group_id: String,
    pub user_id: Option<String>,
    pub exercise_id: String,
    pub ordinal: i32,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoggedSetResponse {
    pub id: String,
    pub logged_activity_id: String,
    pub user_id: Option<String>,
    pub set_number: i32,
    pub set_type: String,
    pub prescribed: Option<String>,
    pub actual_reps: Option<i32>,
    pub actual_weight: Option<String>,
    pub actual_duration: Option<String>,
    pub actual_distance: Option<String>,
    pub actual_pace: Option<String>,
    pub actual_heart_rate: Option<i32>,
    pub ruck_load: Option<String>,
    pub elevation_gain: Option<String>,
    pub rpe: Option<i32>,
    pub completed: Option<i32>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfileResponse {
    pub id: String,
    pub display_name: Option<String>,
    pub preferred_units: Option<String>,
    pub bodyweight: Option<String>,
    pub training_age: Option<String>,
    pub exercise_maxes: Option<String>,
    pub max_reps: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OneRepMaxHistoryResponse {
    pub id: String,
    pub user_id: String,
    pub exercise_id: String,
    pub weight: String,
    pub estimated: Option<i32>,
    pub recorded_at: String,
    pub created_at: String,
}

// ============================================================
// Conversion impls: Row -> Response (timestamp conversion)
// ============================================================

use crate::utils::{unix_to_iso, unix_to_iso_opt};

impl From<ExerciseRow> for ExerciseResponse {
    fn from(r: ExerciseRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            aliases: r.aliases,
            category: r.category,
            movement_pattern: r.movement_pattern,
            muscle_groups: r.muscle_groups,
            is_bilateral: r.is_bilateral,
            supports_1rm: r.supports_1rm,
            equipment_required: r.equipment_required,
            is_custom: r.is_custom,
            created_at: unix_to_iso(r.created_at.unwrap_or(0)),
            updated_at: unix_to_iso(r.updated_at.unwrap_or(0)),
        }
    }
}

impl From<WorkoutLogRow> for WorkoutLogResponse {
    fn from(r: WorkoutLogRow) -> Self {
        Self {
            id: r.id,
            user_id: r.user_id,
            title: r.title,
            started_at: unix_to_iso(r.started_at),
            completed_at: unix_to_iso_opt(r.completed_at),
            session_template_id: r.session_template_id,
            program_context: r.program_context,
            overall_notes: r.overall_notes,
            perceived_difficulty: r.perceived_difficulty,
            bodyweight_at_session: r.bodyweight_at_session,
            created_at: unix_to_iso(r.created_at.unwrap_or(0)),
            updated_at: unix_to_iso(r.updated_at.unwrap_or(0)),
        }
    }
}

impl From<LoggedActivityGroupRow> for LoggedActivityGroupResponse {
    fn from(r: LoggedActivityGroupRow) -> Self {
        Self {
            id: r.id,
            workout_log_id: r.workout_log_id,
            user_id: r.user_id,
            group_type: r.group_type,
            ordinal: r.ordinal,
            actual_rounds_completed: r.actual_rounds_completed,
            completion_time: r.completion_time,
            created_at: unix_to_iso(r.created_at.unwrap_or(0)),
            updated_at: unix_to_iso(r.updated_at.unwrap_or(0)),
        }
    }
}

impl From<LoggedActivityRow> for LoggedActivityResponse {
    fn from(r: LoggedActivityRow) -> Self {
        Self {
            id: r.id,
            logged_group_id: r.logged_group_id,
            user_id: r.user_id,
            exercise_id: r.exercise_id,
            ordinal: r.ordinal,
            notes: r.notes,
            created_at: unix_to_iso(r.created_at.unwrap_or(0)),
            updated_at: unix_to_iso(r.updated_at.unwrap_or(0)),
        }
    }
}

impl From<LoggedSetRow> for LoggedSetResponse {
    fn from(r: LoggedSetRow) -> Self {
        Self {
            id: r.id,
            logged_activity_id: r.logged_activity_id,
            user_id: r.user_id,
            set_number: r.set_number,
            set_type: r.set_type,
            prescribed: r.prescribed,
            actual_reps: r.actual_reps,
            actual_weight: r.actual_weight,
            actual_duration: r.actual_duration,
            actual_distance: r.actual_distance,
            actual_pace: r.actual_pace,
            actual_heart_rate: r.actual_heart_rate,
            ruck_load: r.ruck_load,
            elevation_gain: r.elevation_gain,
            rpe: r.rpe,
            completed: r.completed,
            notes: r.notes,
            created_at: unix_to_iso(r.created_at.unwrap_or(0)),
            updated_at: unix_to_iso(r.updated_at.unwrap_or(0)),
        }
    }
}

impl From<UserProfileRow> for UserProfileResponse {
    fn from(r: UserProfileRow) -> Self {
        Self {
            id: r.id,
            display_name: r.display_name,
            preferred_units: r.preferred_units,
            bodyweight: r.bodyweight,
            training_age: r.training_age,
            exercise_maxes: r.exercise_maxes,
            max_reps: r.max_reps,
            created_at: unix_to_iso(r.created_at.unwrap_or(0)),
            updated_at: unix_to_iso(r.updated_at.unwrap_or(0)),
        }
    }
}

impl From<OneRepMaxHistoryRow> for OneRepMaxHistoryResponse {
    fn from(r: OneRepMaxHistoryRow) -> Self {
        Self {
            id: r.id,
            user_id: r.user_id,
            exercise_id: r.exercise_id,
            weight: r.weight,
            estimated: r.estimated,
            recorded_at: unix_to_iso(r.recorded_at),
            created_at: unix_to_iso(r.created_at.unwrap_or(0)),
        }
    }
}

// ============================================================
// Composite / summary structs for Tauri commands
// ============================================================

/// Summary view for workout history list.
/// Returned by get_workout_logs_summary -- includes aggregated counts.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutLogSummary {
    pub log: WorkoutLogResponse,
    pub exercise_names: Vec<String>,
    pub set_count: i64,
    pub exercise_count: i64,
}

/// Full nested workout log for detail view.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutLogFull {
    pub log: WorkoutLogResponse,
    pub groups: Vec<LoggedActivityGroupResponse>,
    pub activities: Vec<LoggedActivityResponse>,
    pub sets: Vec<LoggedSetResponse>,
}

/// Workout log with its sets for a specific exercise (exercise history).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutWithSets {
    pub log: WorkoutLogResponse,
    pub sets: Vec<LoggedSetResponse>,
}
