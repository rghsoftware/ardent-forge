//! Background event reminder scheduler.
//!
//! Runs a 60-second poll loop that checks whether the user has EVENT category
//! session templates with upcoming event dates. When an event is N days away
//! and N matches one of the configured reminder intervals (default: 7, 3, 1),
//! a countdown notification is fired.
//!
//! Respects notification preferences (enabled flags, quiet hours) stored in
//! the `app_config` table.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Arc;

use chrono::{Local, NaiveDate};
use sqlx::SqlitePool;
use tauri::AppHandle;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use crate::notification;

// ---------------------------------------------------------------------------
// Type aliases
// ---------------------------------------------------------------------------

/// Tracks which (template_id, days_remaining) pairs have already fired
/// today, along with the date they belong to.
type RemindedState = (Option<NaiveDate>, Vec<(String, i64)>);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREFS_KEY: &str = "notification_preferences";
const POLL_INTERVAL_SECS: u64 = 60;

/// Base notification ID for event reminders. Each notification uses
/// `BASE + (hash of template_id + days_remaining) % 1000` to produce a
/// deterministic, non-colliding ID.
const EVENT_REMINDER_NOTIFICATION_ID_BASE: i32 = 3000;

/// Default reminder intervals (days before event) when not configured.
const DEFAULT_INTERVALS: &[i64] = &[7, 3, 1];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/// Managed Tauri state that holds the optional background task handle for the
/// event reminder scheduler.
pub struct EventReminderState {
    handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    /// Tracks which (template_id, days_remaining) pairs have already fired
    /// today, so we only send each reminder once per calendar day.
    reminded_today: Arc<Mutex<RemindedState>>,
}

impl EventReminderState {
    pub fn new() -> Self {
        Self {
            handle: Arc::new(Mutex::new(None)),
            reminded_today: Arc::new(Mutex::new((None, Vec::new()))),
        }
    }

    /// Starts the background reminder loop. If a loop is already running it is
    /// stopped first, so calling `start` is always idempotent.
    pub async fn start(&self, pool: SqlitePool, app: AppHandle) {
        self.stop().await;

        let reminded = Arc::clone(&self.reminded_today);

        let handle = tokio::spawn(async move {
            log::info!("[event-reminder] Background scheduler started");

            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(POLL_INTERVAL_SECS)).await;

                if let Err(e) = tick(&pool, &app, &reminded).await {
                    log::warn!("[event-reminder] Tick error (non-fatal): {e}");
                }
            }
        });

        *self.handle.lock().await = Some(handle);
    }

    /// Stops the background loop if one is running.
    pub async fn stop(&self) {
        if let Some(handle) = self.handle.lock().await.take() {
            handle.abort();
            log::info!("[event-reminder] Background scheduler stopped");
        }
    }
}

impl Default for EventReminderState {
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
    reminded: &Arc<Mutex<RemindedState>>,
) -> Result<(), String> {
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

    // 3. Check eventReminders.enabled
    let event_reminders = prefs.get("eventReminders");
    let reminders_enabled = event_reminders
        .and_then(|er| er.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !reminders_enabled {
        return Ok(());
    }

    // 4. Check quiet hours
    if notification::is_in_quiet_hours(&prefs_json) {
        return Ok(());
    }

    // 5. Parse configured intervals (or use defaults)
    let intervals: Vec<i64> = event_reminders
        .and_then(|er| er.get("intervals"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_i64())
                .filter(|&d| d > 0)
                .collect()
        })
        .unwrap_or_else(|| DEFAULT_INTERVALS.to_vec());

    if intervals.is_empty() {
        return Ok(());
    }

    // 6. Query EVENT session templates with a future event date
    let today = Local::now().date_naive();
    let events = find_upcoming_events(pool).await?;

    // 7. Acquire a single lock for the entire event processing loop to avoid
    //    repeated lock/unlock overhead (W3).
    {
        let mut guard = reminded.lock().await;

        // Reset reminded set if the date has changed
        if guard.0 != Some(today) {
            guard.0 = Some(today);
            guard.1.clear();
        }

        for event in events {
            let days_until = days_between(today, event.event_date);
            if days_until < 0 || !intervals.contains(&days_until) {
                continue;
            }

            // Check if we already reminded for this (template, days_remaining) today
            if guard.1.contains(&(event.template_id.clone(), days_until)) {
                continue;
            }

            // Build notification content
            let title = format!(
                "{} in {} day{}",
                event.name,
                days_until,
                if days_until == 1 { "" } else { "s" }
            );
            let body = if event.total_items > 0 {
                format!(
                    "{} of {} items packed",
                    event.packed_items, event.total_items
                )
            } else {
                "View event details".to_string()
            };

            let notification_id = deterministic_id(&event.template_id, days_until);

            notification::send_notification(
                app,
                "event_reminders",
                &title,
                &body,
                Some(notification_id),
            );

            log::info!(
                "[event-reminder] Fired reminder: {} ({} days away)",
                event.name,
                days_until
            );

            // Record that we reminded for this pair today
            guard.1.push((event.template_id.clone(), days_until));
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Produces a deterministic i32 notification ID from a template ID and
/// days_remaining so that repeated notifications replace rather than stack.
///
/// Generates a stable notification ID for deduplication within a single app version.
/// Uses DefaultHasher which may vary across Rust compiler versions -- this is acceptable
/// because the worst case is one duplicate notification after a compiler upgrade.
fn deterministic_id(template_id: &str, days_remaining: i64) -> i32 {
    let mut hasher = DefaultHasher::new();
    template_id.hash(&mut hasher);
    days_remaining.hash(&mut hasher);
    let hash = hasher.finish();
    // Map into 3000..3999 range to avoid colliding with other notification IDs
    EVENT_REMINDER_NOTIFICATION_ID_BASE + (hash % 1000) as i32
}

/// Returns the number of days from `from` to `to`. Positive means `to` is in
/// the future.
fn days_between(from: NaiveDate, to: NaiveDate) -> i64 {
    (to - from).num_days()
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

/// Reads notification preferences from the `app_config` table. Returns the
/// default preferences JSON if no row exists.
async fn read_prefs(pool: &SqlitePool) -> Result<String, String> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_config WHERE key = ?")
        .bind(PREFS_KEY)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Failed to read notification prefs: {e}"))?;

    Ok(row
        .map(|(v,)| v)
        .unwrap_or_else(|| notification::DEFAULT_PREFS_JSON.to_string()))
}

/// Holds the fields needed from an upcoming EVENT session template.
struct UpcomingEvent {
    template_id: String,
    name: String,
    event_date: NaiveDate,
    total_items: i64,
    packed_items: i64,
}

/// Queries session templates with category = 'EVENT' and a future event date
/// from event_metadata JSON. Also counts packing list items if the
/// event_items table exists.
///
/// NOTE: The local SQLite schema may not yet include event_metadata or
/// event_items columns (those are Phase 2 Supabase-only tables). This
/// function gracefully returns an empty list when the required columns or
/// tables do not exist, keeping the scaffold functional.
async fn find_upcoming_events(pool: &SqlitePool) -> Result<Vec<UpcomingEvent>, String> {
    // First check if the session_templates table has the event_metadata column.
    // If not, the local SQLite schema has not been migrated yet and we return
    // an empty list.
    let col_check: Option<(String,)> = sqlx::query_as(
        "SELECT name FROM pragma_table_info('session_templates') WHERE name = 'event_metadata'",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to check event_metadata column: {e}"))?;

    if col_check.is_none() {
        return Ok(Vec::new());
    }

    // Check whether event_items table exists
    let items_table_exists: Option<(String,)> = sqlx::query_as(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'event_items'",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to check event_items table: {e}"))?;

    let rows: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT id, name, event_metadata \
         FROM session_templates \
         WHERE category = 'EVENT' AND event_metadata IS NOT NULL",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to query EVENT session templates: {e}"))?;

    let mut events = Vec::new();

    for (template_id, name, metadata_json) in rows {
        // Parse event_metadata to extract the date
        let metadata: serde_json::Value = match serde_json::from_str(&metadata_json) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let date_str = match metadata.get("eventDate").and_then(|v| v.as_str()) {
            Some(d) => d,
            None => continue,
        };

        let event_date = match NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            Ok(d) => d,
            Err(_) => {
                // Try ISO-8601 with time component (take date portion)
                match date_str
                    .get(..10)
                    .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
                {
                    Some(d) => d,
                    None => continue,
                }
            }
        };

        // Count packing list items if the table exists
        let (total_items, packed_items) = if items_table_exists.is_some() {
            count_packing_items(pool, &template_id)
                .await
                .unwrap_or((0, 0))
        } else {
            (0, 0)
        };

        events.push(UpcomingEvent {
            template_id,
            name,
            event_date,
            total_items,
            packed_items,
        });
    }

    Ok(events)
}

/// Counts total and packed event_items for a given session template.
async fn count_packing_items(pool: &SqlitePool, template_id: &str) -> Result<(i64, i64), String> {
    let row: Option<(i64, i64)> = sqlx::query_as(
        "SELECT \
             COUNT(*) as total, \
             SUM(CASE WHEN is_packed = 1 THEN 1 ELSE 0 END) as packed \
         FROM event_items \
         WHERE session_template_id = ?",
    )
    .bind(template_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to count event items: {e}"))?;

    Ok(row.unwrap_or((0, 0)))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_reminder_state_default_creates_empty() {
        let state = EventReminderState::new();
        let _ = state;
    }

    #[test]
    fn deterministic_id_is_stable() {
        let id1 = deterministic_id("abc-123", 7);
        let id2 = deterministic_id("abc-123", 7);
        assert_eq!(id1, id2, "Same inputs should produce the same ID");
    }

    #[test]
    fn deterministic_id_varies_by_days() {
        let id_7 = deterministic_id("abc-123", 7);
        let id_3 = deterministic_id("abc-123", 3);
        assert_ne!(id_7, id_3, "Different days should produce different IDs");
    }

    #[test]
    fn deterministic_id_varies_by_template() {
        let id_a = deterministic_id("template-a", 1);
        let id_b = deterministic_id("template-b", 1);
        assert_ne!(
            id_a, id_b,
            "Different templates should produce different IDs"
        );
    }

    #[test]
    fn deterministic_id_in_expected_range() {
        let id = deterministic_id("some-uuid", 3);
        assert!(id >= 3000 && id < 4000, "ID {id} should be in 3000..3999");
    }

    #[test]
    fn days_between_future_date() {
        let from = NaiveDate::from_ymd_opt(2026, 4, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 4, 8).unwrap();
        assert_eq!(days_between(from, to), 7);
    }

    #[test]
    fn days_between_past_date() {
        let from = NaiveDate::from_ymd_opt(2026, 4, 8).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 4, 1).unwrap();
        assert_eq!(days_between(from, to), -7);
    }

    #[test]
    fn days_between_same_date() {
        let date = NaiveDate::from_ymd_opt(2026, 4, 1).unwrap();
        assert_eq!(days_between(date, date), 0);
    }
}
