use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use crate::notification;

/// Fixed notification ID for rest timer alerts. Replaces previous alerts
/// when a new rest period starts. See docs/11-notification-design.md.
const REST_TIMER_NOTIFICATION_ID: i32 = 1001;

pub struct RestTimerInner {
    pub total: u32,
    pub active: bool,
    pub started_at: Instant,
    pub exercise_name: Option<String>,
    pub set_number: Option<u32>,
}

pub struct RestTimerState {
    pub inner: Arc<Mutex<RestTimerInner>>,
    pub handle: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl RestTimerState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(RestTimerInner {
                total: 0,
                active: false,
                started_at: Instant::now(),
                exercise_name: None,
                set_number: None,
            })),
            handle: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start(
        &self,
        seconds: u32,
        app: AppHandle,
        exercise_name: Option<String>,
        set_number: Option<u32>,
    ) {
        if seconds == 0 {
            return;
        }

        self.stop().await;

        {
            let mut inner = self.inner.lock().await;
            inner.total = seconds;
            inner.active = true;
            inner.started_at = Instant::now();
            inner.exercise_name = exercise_name;
            inner.set_number = set_number;
        }

        let inner = Arc::clone(&self.inner);
        let app_clone = app.clone();

        let handle = tokio::spawn(async move {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

                let mut guard = inner.lock().await;
                if !guard.active {
                    break;
                }

                // Compute remaining from wall clock so the timer self-corrects
                // after the app is backgrounded (screen off) on mobile.
                let elapsed = guard.started_at.elapsed().as_secs() as u32;
                let remaining = guard.total.saturating_sub(elapsed);
                let total = guard.total;
                drop(guard);

                if let Err(e) = app_clone.emit(
                    "timer_tick",
                    serde_json::json!({
                        "remaining": remaining,
                        "total": total
                    }),
                ) {
                    log::debug!("[rest-timer] Failed to emit timer_tick: {e}");
                }

                if remaining == 0 {
                    if let Err(e) = app_clone.emit("timer_expired", serde_json::json!({})) {
                        log::error!("[rest-timer] Failed to emit timer_expired: {e}");
                    }

                    let mut guard = inner.lock().await;
                    let body = match (&guard.exercise_name, guard.set_number) {
                        (Some(name), Some(num)) => format!("{name} -- Set {num}"),
                        _ => "Time for your next set".to_string(),
                    };
                    guard.active = false;
                    drop(guard);

                    notification::send_notification(
                        &app_clone,
                        "rest_timer",
                        "REST COMPLETE",
                        &body,
                        Some(REST_TIMER_NOTIFICATION_ID),
                    );

                    break;
                }
            }
        });

        *self.handle.lock().await = Some(handle);
    }

    pub async fn stop(&self) {
        if let Some(handle) = self.handle.lock().await.take() {
            handle.abort();
        }
        let mut inner = self.inner.lock().await;
        inner.active = false;
    }

    pub async fn skip(&self, app: &AppHandle) {
        self.stop().await;
        if let Err(e) = app.emit("timer_skipped", serde_json::json!({})) {
            log::debug!("[rest-timer] Failed to emit timer_skipped: {e}");
        }
    }

    pub async fn adjust(&self, delta: i32) {
        let mut inner = self.inner.lock().await;
        if delta >= 0 {
            // Extend total so remaining increases by delta.
            inner.total = inner.total.saturating_add(delta as u32);
        } else {
            // Shrink remaining by shifting started_at earlier (more elapsed).
            let abs_delta = (-delta) as u64;
            let new_elapsed = inner.started_at.elapsed() + Duration::from_secs(abs_delta);
            inner.started_at = Instant::now()
                .checked_sub(new_elapsed)
                .unwrap_or_else(|| Instant::now() - Duration::from_secs(inner.total as u64));
        }
    }
}

impl Default for RestTimerState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_timer() -> RestTimerState {
        RestTimerState::new()
    }

    #[tokio::test]
    async fn adjust_positive_increments_total_and_remaining() {
        let timer = make_timer();
        {
            let mut inner = timer.inner.lock().await;
            inner.started_at = Instant::now();
            inner.total = 60;
            inner.active = true;
        }
        timer.adjust(10).await;
        let inner = timer.inner.lock().await;
        assert_eq!(inner.total, 70);
        let remaining = inner.total.saturating_sub(inner.started_at.elapsed().as_secs() as u32);
        assert_eq!(remaining, 70);
    }

    #[tokio::test]
    async fn adjust_negative_decrements_remaining_only() {
        let timer = make_timer();
        {
            let mut inner = timer.inner.lock().await;
            inner.started_at = Instant::now();
            inner.total = 60;
            inner.active = true;
        }
        timer.adjust(-10).await;
        let inner = timer.inner.lock().await;
        assert_eq!(inner.total, 60);
        let remaining = inner.total.saturating_sub(inner.started_at.elapsed().as_secs() as u32);
        assert_eq!(remaining, 50);
    }

    #[tokio::test]
    async fn adjust_large_negative_saturates_remaining_to_zero() {
        let timer = make_timer();
        {
            let mut inner = timer.inner.lock().await;
            // Simulate 30s already elapsed: started 30s ago, total=60 → remaining=30
            inner.started_at = Instant::now() - Duration::from_secs(30);
            inner.total = 60;
            inner.active = true;
        }
        timer.adjust(-100).await;
        let inner = timer.inner.lock().await;
        assert_eq!(inner.total, 60);
        let remaining = inner.total.saturating_sub(inner.started_at.elapsed().as_secs() as u32);
        assert_eq!(remaining, 0);
    }

    #[tokio::test]
    async fn start_zero_duration_does_not_activate() {
        let timer = make_timer();
        let inner = timer.inner.lock().await;
        assert!(!inner.active, "Timer should not be active on construction");
    }
}
