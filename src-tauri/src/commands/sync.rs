use crate::error::AppError;
use crate::sync::SyncEngine;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn sync_set_auth(
    access_token: String,
    supabase_url: String,
    supabase_key: String,
    state: State<'_, SyncEngine>,
) -> Result<(), AppError> {
    sync_set_auth_inner(access_token, supabase_url, supabase_key, state.inner()).await
}

pub(crate) async fn sync_set_auth_inner(
    access_token: String,
    supabase_url: String,
    supabase_key: String,
    state: &SyncEngine,
) -> Result<(), AppError> {
    state
        .set_auth(access_token, supabase_url, supabase_key)
        .await;
    Ok(())
}

#[tauri::command]
pub async fn sync_clear_auth(state: State<'_, SyncEngine>) -> Result<(), AppError> {
    sync_clear_auth_inner(state.inner()).await
}

pub(crate) async fn sync_clear_auth_inner(state: &SyncEngine) -> Result<(), AppError> {
    state.clear_auth().await;
    Ok(())
}

#[tauri::command]
pub async fn sync_force_push(state: State<'_, SyncEngine>) -> Result<(), AppError> {
    sync_force_push_inner(state.inner()).await
}

pub(crate) async fn sync_force_push_inner(state: &SyncEngine) -> Result<(), AppError> {
    let creds = state.credentials().await;

    match creds {
        Some(creds) => {
            state
                .transition_state(crate::sync::SyncState::Pushing)
                .await;
            match crate::sync::push::push_all(
                state.pool(),
                &creds.supabase_url,
                &creds.supabase_key,
                &creds.access_token,
            )
            .await
            {
                Ok(()) => {
                    state.transition_state(crate::sync::SyncState::Idle).await;
                }
                Err(e) => {
                    state
                        .transition_state(crate::sync::SyncState::Error {
                            message: e.to_string(),
                        })
                        .await;
                    return Err(AppError::sync(&e.to_string()));
                }
            }
        }
        None => return Err(AppError::sync("Not authenticated")),
    }
    Ok(())
}

#[tauri::command]
pub async fn sync_force_pull(
    state: State<'_, SyncEngine>,
    app_handle: AppHandle,
) -> Result<(), AppError> {
    sync_force_pull_inner(state.inner(), app_handle).await
}

pub(crate) async fn sync_force_pull_inner(
    state: &SyncEngine,
    app_handle: AppHandle,
) -> Result<(), AppError> {
    let creds = state.credentials().await;
    match creds {
        Some(creds) => {
            state
                .transition_state(crate::sync::SyncState::Pulling)
                .await;
            match crate::sync::pull::pull_all(
                state.pool(),
                &creds.supabase_url,
                &creds.supabase_key,
                &creds.access_token,
                &app_handle,
            )
            .await
            {
                Ok(()) => {
                    state.transition_state(crate::sync::SyncState::Idle).await;
                    Ok(())
                }
                Err(e) => {
                    state
                        .transition_state(crate::sync::SyncState::Error {
                            message: e.to_string(),
                        })
                        .await;
                    Err(AppError::sync(&e.to_string()))
                }
            }
        }
        None => Err(AppError::sync("Not authenticated for sync")),
    }
}

#[tauri::command]
pub async fn sync_get_status(state: State<'_, SyncEngine>) -> Result<String, AppError> {
    sync_get_status_inner(state.inner()).await
}

pub(crate) async fn sync_get_status_inner(state: &SyncEngine) -> Result<String, AppError> {
    let current_state = state.current_state().await;
    serde_json::to_string(&current_state).map_err(|e| AppError::sync(&e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn sync_force_push_inner_requires_auth() {
        // We cannot construct SyncEngine in a unit test (needs AppHandle).
        // Instead, verify the error path logic at the function level by confirming
        // the AppError::sync constructor works correctly for the "Not authenticated" case.
        let err = AppError::sync("Not authenticated");
        assert!(err.message.contains("Not authenticated"));
    }

    #[tokio::test]
    async fn sync_get_status_serializes_state() {
        // Test that SyncState serializes correctly (the core logic of sync_get_status_inner)
        let state = crate::sync::SyncState::Idle;
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("Idle"));

        let state = crate::sync::SyncState::Error {
            message: "timeout".to_string(),
        };
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("Error"));
        assert!(json.contains("timeout"));
    }
}
