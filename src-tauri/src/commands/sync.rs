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
    state
        .set_auth(access_token, supabase_url, supabase_key)
        .await;
    Ok(())
}

#[tauri::command]
pub async fn sync_clear_auth(state: State<'_, SyncEngine>) -> Result<(), AppError> {
    state.clear_auth().await;
    Ok(())
}

#[tauri::command]
pub async fn sync_force_push(state: State<'_, SyncEngine>) -> Result<(), AppError> {
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
    let current_state = state.current_state().await;
    serde_json::to_string(&current_state).map_err(|e| AppError::sync(&e.to_string()))
}
