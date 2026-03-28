pub mod conflict;
pub mod pull;
pub mod push;
pub mod queue;

use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;

use sqlx::SqlitePool;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type")]
pub enum SyncState {
    Offline,
    AuthRequired,
    Pushing,
    Pulling,
    Idle,
    Error { message: String },
}

pub struct SyncEngine {
    pub state: Arc<RwLock<SyncState>>,
    pub pool: SqlitePool,
    pub supabase_url: Arc<RwLock<Option<String>>>,
    pub supabase_key: Arc<RwLock<Option<String>>>,
    pub access_token: Arc<RwLock<Option<String>>>,
    pub app_handle: AppHandle,
}

impl SyncEngine {
    pub fn new(pool: SqlitePool, app_handle: AppHandle) -> Self {
        Self {
            state: Arc::new(RwLock::new(SyncState::Offline)),
            pool,
            supabase_url: Arc::new(RwLock::new(None)),
            supabase_key: Arc::new(RwLock::new(None)),
            access_token: Arc::new(RwLock::new(None)),
            app_handle,
        }
    }

    pub async fn set_auth(
        &self,
        access_token: String,
        supabase_url: String,
        supabase_key: String,
    ) {
        *self.supabase_url.write().await = Some(supabase_url);
        *self.supabase_key.write().await = Some(supabase_key);
        *self.access_token.write().await = Some(access_token);
        self.transition_state(SyncState::Idle).await;
        self.start_sync_loop();
    }

    pub async fn clear_auth(&self) {
        *self.access_token.write().await = None;
        self.transition_state(SyncState::Offline).await;
    }

    pub async fn transition_state(&self, new_state: SyncState) {
        *self.state.write().await = new_state.clone();
        let _ = self.app_handle.emit("sync:state_changed", &new_state);
    }

    pub fn start_sync_loop(&self) {
        let state = Arc::clone(&self.state);
        let pool = self.pool.clone();
        let supabase_url = Arc::clone(&self.supabase_url);
        let supabase_key = Arc::clone(&self.supabase_key);
        let access_token = Arc::clone(&self.access_token);
        let app_handle = self.app_handle.clone();

        tokio::spawn(async move {
            loop {
                // Check if still authenticated
                let token = access_token.read().await.clone();
                if token.is_none() {
                    break;
                }

                let url = supabase_url.read().await.clone();
                let key = supabase_key.read().await.clone();

                if let (Some(token), Some(url), Some(key)) = (token, url, key) {
                    // Push phase
                    *state.write().await = SyncState::Pushing;
                    let _ = app_handle.emit("sync:state_changed", &*state.read().await);

                    if let Err(e) = push::push_all(&pool, &url, &key, &token).await {
                        eprintln!("Sync push error: {e}");
                        *state.write().await = SyncState::Error {
                            message: e.to_string(),
                        };
                        let _ = app_handle.emit("sync:state_changed", &*state.read().await);
                    } else {
                        *state.write().await = SyncState::Idle;
                        let _ = app_handle.emit("sync:state_changed", &*state.read().await);
                    }

                    // Flush offline queue
                    if let Err(e) = queue::flush(&pool, &url, &key, &token).await {
                        eprintln!("Queue flush error: {e}");
                    }
                }

                // Wait 30 seconds before next cycle
                tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            }
        });
    }
}
