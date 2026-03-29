//! Background session reminder scheduler.
//!
//! Runs a 60-second poll loop that checks whether the user has an active
//! program with a session scheduled for today. If a session exists and has
//! not already been logged, fires a single reminder notification per day.
//!
//! Respects notification preferences (enabled flags, quiet hours) stored in
//! the `app_config` table.

use std::sync::Arc;

use chrono::{Datelike, Local, NaiveDate};
use sqlx::SqlitePool;
use tauri::AppHandle;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use chrono::Timelike;

use crate::notification;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREFS_KEY: &str = "notification_preferences";
const POLL_INTERVAL_SECS: u64 = 60;
const REMINDER_NOTIFICATION_ID: i32 = 2001;

/// Earliest hour (inclusive) at which a reminder may fire.
const REMINDER_WINDOW_START_HOUR: u32 = 6;
/// Latest hour (inclusive) at which a reminder may fire.
const REMINDER_WINDOW_END_HOUR: u32 = 20;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/// Managed Tauri state that holds the optional background task handle for the
/// session reminder scheduler.
pub struct SessionReminderState {
    handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    last_reminded_date: Arc<Mutex<Option<NaiveDate>>>,
}

impl SessionReminderState {
    pub fn new() -> Self {
        Self {
            handle: Arc::new(Mutex::new(None)),
            last_reminded_date: Arc::new(Mutex::new(None)),
        }
    }

    /// Starts the background reminder loop. If a loop is already running it is
    /// stopped first, so calling `start` is always idempotent.
    pub async fn start(&self, pool: SqlitePool, app: AppHandle) {
        // Stop any existing loop before spawning a new one
        self.stop().await;

        let last_reminded = Arc::clone(&self.last_reminded_date);

        let handle = tokio::spawn(async move {
            log::info!("[session-reminder] Background scheduler started");

            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;

                if let Err(e) = tick(&pool, &app, &last_reminded).await {
                    log::warn!("[session-reminder] Tick error (non-fatal): {e}");
                }
            }
        });

        *self.handle.lock().await = Some(handle);
    }

    /// Stops the background loop if one is running.
    pub async fn stop(&self) {
        if let Some(handle) = self.handle.lock().await.take() {
            handle.abort();
            log::info!("[session-reminder] Background scheduler stopped");
        }
    }
}

impl Default for SessionReminderState {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Tick logic -- one iteration of the poll loop
// ---------------------------------------------------------------------------

/// Performs a single check cycle. Returns `Err` only for unexpected DB errors;
/// all "skip" conditions return `Ok(())`.
async fn tick(
    pool: &SqlitePool,
    app: &AppHandle,
    last_reminded: &Arc<Mutex<Option<NaiveDate>>>,
) -> Result<(), String> {
    // NOTE: advanceMinutes from preferences is not yet consumed; the current
    // implementation fires once per day within the 06:00-20:59 window.

    // 1. Read notification preferences
    let prefs_json = read_prefs(pool).await?;

    // 2. Check global enabled flag
    let prefs: serde_json::Value = serde_json::from_str(&prefs_json)
        .map_err(|e| format!("Failed to parse notification prefs: {e}"))?;

    let globally_enabled = prefs
        .get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !globally_enabled {
        return Ok(());
    }

    // 3. Check sessionReminders.enabled
    let session_reminders = prefs.get("sessionReminders");
    let reminders_enabled = session_reminders
        .and_then(|sr| sr.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !reminders_enabled {
        return Ok(());
    }

    // 4. Check quiet hours
    if notification::is_in_quiet_hours(&prefs_json) {
        return Ok(());
    }

    // 5. Check time window (only fire between 06:00 and 20:59)
    let now = Local::now();
    let current_hour = now.hour();
    if current_hour < REMINDER_WINDOW_START_HOUR || current_hour > REMINDER_WINDOW_END_HOUR {
        return Ok(());
    }

    // 6. Check if we already reminded today
    let today = now.date_naive();
    {
        let guard = last_reminded.lock().await;
        if *guard == Some(today) {
            return Ok(());
        }
    }

    // 7. Find active program activation (any user -- local device has one user)
    let activation = find_active_program(pool).await?;
    let activation = match activation {
        Some(a) => a,
        None => return Ok(()),
    };

    // 8. Determine today's day_of_week (chrono::Weekday orders Mon..Sun;
    //    our schema uses 0=Sun, 1=Mon..6=Sat matching JS Date.getDay())
    let chrono_weekday = now.weekday();
    let js_day_of_week: i64 = match chrono_weekday {
        chrono::Weekday::Sun => 0,
        chrono::Weekday::Mon => 1,
        chrono::Weekday::Tue => 2,
        chrono::Weekday::Wed => 3,
        chrono::Weekday::Thu => 4,
        chrono::Weekday::Fri => 5,
        chrono::Weekday::Sat => 6,
    };

    // 9. Query scheduled sessions for today from the active program's current
    //    block and week
    let session_name = find_todays_session(
        pool,
        &activation.program_id,
        activation.current_block_ordinal,
        activation.current_week_number,
        js_day_of_week,
    )
    .await?;

    let session_name = match session_name {
        Some(name) => name,
        None => return Ok(()),
    };

    // 10. Check if a workout was already logged today
    if was_workout_logged_today(pool, &today).await? {
        // Mark as reminded to avoid re-checking until tomorrow
        let mut guard = last_reminded.lock().await;
        *guard = Some(today);
        return Ok(());
    }

    // 11. Fire the notification
    let title = if session_name.is_empty() {
        "SESSION TODAY".to_string()
    } else {
        session_name
    };

    notification::send_notification(
        app,
        "workout_reminders",
        &title,
        "A training session is scheduled for today",
        Some(REMINDER_NOTIFICATION_ID),
    );

    log::info!("[session-reminder] Fired reminder: {title}");

    // 12. Mark today as reminded
    let mut guard = last_reminded.lock().await;
    *guard = Some(today);

    Ok(())
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

/// Reads notification preferences from the `app_config` table. Returns the
/// default preferences JSON if no row exists.
async fn read_prefs(pool: &SqlitePool) -> Result<String, String> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_config WHERE key = ?")
            .bind(PREFS_KEY)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Failed to read notification prefs: {e}"))?;

    Ok(row
        .map(|(v,)| v)
        .unwrap_or_else(|| notification::DEFAULT_PREFS_JSON.to_string()))
}

/// Holds the fields we need from `program_activations`.
struct ActiveProgram {
    program_id: String,
    current_block_ordinal: i64,
    current_week_number: i64,
}

/// Finds the first active program activation. In a single-user local-first app
/// there is at most one row in `program_activations`.
async fn find_active_program(pool: &SqlitePool) -> Result<Option<ActiveProgram>, String> {
    let row: Option<(String, i64, i64)> = sqlx::query_as(
        "SELECT program_id, current_block_ordinal, current_week_number \
         FROM program_activations LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to query program_activations: {e}"))?;

    Ok(row.map(|(program_id, block_ord, week_num)| ActiveProgram {
        program_id,
        current_block_ordinal: block_ord,
        current_week_number: week_num,
    }))
}

/// Queries for a scheduled session on the given day_of_week within the active
/// program's current block and week. Returns the session template name (via
/// join to `session_templates`) or the day_label as a fallback.
async fn find_todays_session(
    pool: &SqlitePool,
    program_id: &str,
    block_ordinal: i64,
    week_number: i64,
    day_of_week: i64,
) -> Result<Option<String>, String> {
    // Join through: program -> blocks -> block_weeks -> scheduled_sessions -> session_templates
    let row: Option<(String, String)> = sqlx::query_as(
        "SELECT ss.day_label, st.name \
         FROM scheduled_sessions ss \
         JOIN block_weeks bw ON ss.block_week_id = bw.id \
         JOIN blocks b ON bw.block_id = b.id \
         JOIN session_templates st ON ss.session_template_id = st.id \
         WHERE b.program_id = ? \
           AND b.ordinal = ? \
           AND bw.week_number = ? \
           AND ss.day_of_week = ? \
         LIMIT 1",
    )
    .bind(program_id)
    .bind(block_ordinal)
    .bind(week_number)
    .bind(day_of_week)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to query today's session: {e}"))?;

    Ok(row.map(|(day_label, template_name)| {
        if template_name.is_empty() {
            day_label
        } else {
            template_name
        }
    }))
}

/// Returns `true` if at least one workout log exists with a `started_at`
/// timestamp falling on the given date (local time).
async fn was_workout_logged_today(
    pool: &SqlitePool,
    today: &NaiveDate,
) -> Result<bool, String> {
    // Calculate Unix epoch range for today in local time
    let local_tz = Local::now().timezone();
    let start_of_day = today
        .and_hms_opt(0, 0, 0)
        .expect("valid time")
        .and_local_timezone(local_tz)
        .earliest()
        .ok_or_else(|| "Failed to resolve timezone for start_of_day".to_string())?
        .timestamp();
    let end_of_day = today
        .and_hms_opt(23, 59, 59)
        .expect("valid time")
        .and_local_timezone(local_tz)
        .earliest()
        .ok_or_else(|| "Failed to resolve timezone for end_of_day".to_string())?
        .timestamp();

    let row: Option<(i32,)> = sqlx::query_as(
        "SELECT 1 FROM workout_logs WHERE started_at >= ? AND started_at <= ? LIMIT 1",
    )
    .bind(start_of_day)
    .bind(end_of_day)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to query workout_logs: {e}"))?;

    Ok(row.is_some())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_reminder_state_default_creates_empty() {
        let state = SessionReminderState::new();
        // Cannot directly inspect async mutex without runtime, but ensure
        // construction does not panic.
        let _ = state;
    }

    #[test]
    fn js_day_of_week_mapping() {
        // Verify our chrono -> JS day_of_week mapping covers all variants
        let mappings = [
            (chrono::Weekday::Sun, 0i64),
            (chrono::Weekday::Mon, 1),
            (chrono::Weekday::Tue, 2),
            (chrono::Weekday::Wed, 3),
            (chrono::Weekday::Thu, 4),
            (chrono::Weekday::Fri, 5),
            (chrono::Weekday::Sat, 6),
        ];
        for (weekday, expected) in mappings {
            let result = match weekday {
                chrono::Weekday::Sun => 0i64,
                chrono::Weekday::Mon => 1,
                chrono::Weekday::Tue => 2,
                chrono::Weekday::Wed => 3,
                chrono::Weekday::Thu => 4,
                chrono::Weekday::Fri => 5,
                chrono::Weekday::Sat => 6,
            };
            assert_eq!(result, expected, "Weekday {:?} should map to {}", weekday, expected);
        }
    }
}
