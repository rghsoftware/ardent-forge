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
        // Cancel existing timer
        self.stop().await;

        // Set state
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

                // Emit tick event
                let _ = app_clone.emit(
                    "timer_tick",
                    serde_json::json!({
                        "remaining": remaining,
                        "total": total
                    }),
                );

                if remaining == 0 {
                    // Emit expired event
                    let _ = app_clone.emit("timer_expired", serde_json::json!({}));

                    // Send notification
                    use tauri_plugin_notification::NotificationExt;
                    let _ = app_clone
                        .notification()
                        .builder()
                        .title("Rest Complete")
                        .body("Time to get back to work!")
                        .show();

                    // Mark inactive
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
            inner.total = inner.total.saturating_sub(abs_delta);
        }
    }
}

impl Default for RestTimerState {
    fn default() -> Self {
        Self::new()
    }
}
