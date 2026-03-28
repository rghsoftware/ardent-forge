pub mod conflict;
pub mod pull;
pub mod push;
pub mod queue;

use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;

use sqlx::SqlitePool;

pub const SYNCABLE_TABLES: &[&str] = &[
    "exercises",
    "workout_logs",
    "logged_activity_groups",
    "logged_activities",
    "logged_sets",
    "user_profiles",
    "one_rep_max_history",
    "session_templates",
    "activity_groups",
    "activities",
    "programs",
    "blocks",
    "block_weeks",
    "scheduled_sessions",
    "program_activations",
];

#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type")]
pub enum SyncState {
    Offline,
    Pushing,
    Pulling,
    Idle,
    Error { message: String },
}

#[derive(Clone)]
pub struct SyncCredentials {
    pub supabase_url: String,
    pub supabase_key: String,
    pub access_token: String,
}

/// Emit a state-changed Tauri event and update the shared state atomically.
/// All state transitions must go through this function.
pub async fn transition_state(
    state: &RwLock<SyncState>,
    app_handle: &AppHandle,
    new_state: SyncState,
) {
    *state.write().await = new_state.clone();
    let _ = app_handle.emit("sync:state_changed", &new_state);
}

pub struct SyncEngine {
    state: Arc<RwLock<SyncState>>,
    pool: SqlitePool,
    credentials: Arc<RwLock<Option<SyncCredentials>>>,
    app_handle: AppHandle,
    sync_handle: Arc<tokio::sync::Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl SyncEngine {
    pub fn new(pool: SqlitePool, app_handle: AppHandle) -> Self {
        Self {
            state: Arc::new(RwLock::new(SyncState::Offline)),
            pool,
            credentials: Arc::new(RwLock::new(None)),
            app_handle,
            sync_handle: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    // ---- accessors ----

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn current_state(&self) -> SyncState {
        self.state.read().await.clone()
    }

    pub async fn credentials(&self) -> Option<SyncCredentials> {
        self.credentials.read().await.clone()
    }

    // ---- auth lifecycle ----

    pub async fn set_auth(
        &self,
        access_token: String,
        supabase_url: String,
        supabase_key: String,
    ) {
        *self.credentials.write().await = Some(SyncCredentials {
            supabase_url,
            supabase_key,
            access_token,
        });

        // Abort any previous sync loop before spawning a new one
        {
            let mut handle = self.sync_handle.lock().await;
            if let Some(h) = handle.take() {
                h.abort();
            }
        }

        transition_state(&self.state, &self.app_handle, SyncState::Idle).await;

        let join_handle = self.spawn_sync_loop();
        *self.sync_handle.lock().await = Some(join_handle);
    }

    pub async fn clear_auth(&self) {
        // Abort the sync loop
        {
            let mut handle = self.sync_handle.lock().await;
            if let Some(h) = handle.take() {
                h.abort();
            }
        }

        // Clear all credentials
        *self.credentials.write().await = None;

        transition_state(&self.state, &self.app_handle, SyncState::Offline).await;
    }

    pub async fn transition_state(&self, new_state: SyncState) {
        transition_state(&self.state, &self.app_handle, new_state).await;
    }

    // ---- sync loop ----

    fn spawn_sync_loop(&self) -> tokio::task::JoinHandle<()> {
        let state = Arc::clone(&self.state);
        let pool = self.pool.clone();
        let credentials = Arc::clone(&self.credentials);
        let app_handle = self.app_handle.clone();

        tokio::spawn(async move {
            loop {
                let creds = credentials.read().await.clone();
                let creds = match creds {
                    Some(c) => c,
                    None => break,
                };

                // Push phase
                transition_state(&state, &app_handle, SyncState::Pushing).await;

                if let Err(e) = push::push_all(
                    &pool,
                    &creds.supabase_url,
                    &creds.supabase_key,
                    &creds.access_token,
                )
                .await
                {
                    eprintln!("Sync push error: {e}");
                    transition_state(
                        &state,
                        &app_handle,
                        SyncState::Error {
                            message: e.to_string(),
                        },
                    )
                    .await;
                } else {
                    transition_state(&state, &app_handle, SyncState::Idle).await;
                }

                // Flush offline queue
                if let Err(e) = queue::flush(
                    &pool,
                    &creds.supabase_url,
                    &creds.supabase_key,
                    &creds.access_token,
                    &app_handle,
                )
                .await
                {
                    log::error!("[sync] Queue flush failed: {e}");
                    transition_state(
                        &state,
                        &app_handle,
                        SyncState::Error {
                            message: e.to_string(),
                        },
                    )
                    .await;
                    return;
                }

                // Wait 30 seconds before next cycle
                tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            }
        })
    }
}
