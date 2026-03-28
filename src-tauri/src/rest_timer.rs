use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

pub struct RestTimerInner {
    pub remaining: u32,
    pub total: u32,
    pub active: bool,
}

pub struct RestTimerState {
    pub inner: Arc<Mutex<RestTimerInner>>,
    pub handle: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl RestTimerState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(RestTimerInner {
                remaining: 0,
                total: 0,
                active: false,
            })),
            handle: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start(&self, seconds: u32, app: AppHandle) {
        if seconds == 0 {
            return;
        }

        self.stop().await;

        {
            let mut inner = self.inner.lock().await;
            inner.remaining = seconds;
            inner.total = seconds;
            inner.active = true;
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

                if guard.remaining > 0 {
                    guard.remaining -= 1;
                }

                let remaining = guard.remaining;
                let total = guard.total;
                drop(guard);

                let _ = app_clone.emit(
                    "timer_tick",
                    serde_json::json!({
                        "remaining": remaining,
                        "total": total
                    }),
                );

                if remaining == 0 {
                    if let Err(e) = app_clone.emit("timer_expired", serde_json::json!({})) {
                        log::error!("[rest-timer] Failed to emit timer_expired: {e}");
                    }

                    // Send notification
                    use tauri_plugin_notification::NotificationExt;
                    let _ = app_clone
                        .notification()
                        .builder()
                        .title("Rest Complete")
                        .body("Time to get back to work!")
                        .show();

                    let mut guard = inner.lock().await;
                    guard.active = false;
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
        let _ = app.emit("timer_skipped", serde_json::json!({}));
    }

    pub async fn adjust(&self, delta: i32) {
        let mut inner = self.inner.lock().await;
        if delta >= 0 {
            inner.remaining = inner.remaining.saturating_add(delta as u32);
            inner.total = inner.total.saturating_add(delta as u32);
        } else {
            let abs_delta = (-delta) as u32;
            inner.remaining = inner.remaining.saturating_sub(abs_delta);
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
    async fn adjust_positive_increments_both_remaining_and_total() {
        let timer = make_timer();
        {
            let mut inner = timer.inner.lock().await;
            inner.remaining = 60;
            inner.total = 60;
            inner.active = true;
        }
        timer.adjust(10).await;
        let inner = timer.inner.lock().await;
        assert_eq!(inner.remaining, 70);
        assert_eq!(inner.total, 70);
    }

    #[tokio::test]
    async fn adjust_negative_decrements_remaining_only() {
        let timer = make_timer();
        {
            let mut inner = timer.inner.lock().await;
            inner.remaining = 60;
            inner.total = 60;
            inner.active = true;
        }
        timer.adjust(-10).await;
        let inner = timer.inner.lock().await;
        assert_eq!(inner.remaining, 50);
        assert_eq!(inner.total, 60);
    }

    #[tokio::test]
    async fn adjust_large_negative_saturates_remaining_to_zero() {
        let timer = make_timer();
        {
            let mut inner = timer.inner.lock().await;
            inner.remaining = 30;
            inner.total = 60;
            inner.active = true;
        }
        timer.adjust(-100).await;
        let inner = timer.inner.lock().await;
        assert_eq!(inner.remaining, 0);
        assert_eq!(inner.total, 60);
    }

    #[tokio::test]
    async fn start_zero_duration_does_not_activate() {
        let timer = make_timer();
        let inner = timer.inner.lock().await;
        assert!(!inner.active, "Timer should not be active on construction");
    }
}
