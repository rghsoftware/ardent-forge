use crate::error::AppError;
use crate::sync::SyncEngine;
use tauri::State;

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
            crate::sync::push::push_all(
                state.pool(),
                &creds.supabase_url,
                &creds.supabase_key,
                &creds.access_token,
            )
            .await
            .map_err(|e| AppError::sync(&e.to_string()))?;
            state
                .transition_state(crate::sync::SyncState::Idle)
                .await;
        }
        None => return Err(AppError::sync("Not authenticated")),
    }
    Ok(())
}

#[tauri::command]
pub async fn sync_force_pull(state: State<'_, SyncEngine>) -> Result<(), AppError> {
    let current_state = state.current_state().await;
    if let crate::sync::SyncState::Offline = current_state {
        return Err(AppError::sync("Not authenticated for sync"));
    }
    Err(AppError::sync("Force pull is not yet implemented"))
}

#[tauri::command]
pub async fn sync_get_status(state: State<'_, SyncEngine>) -> Result<String, AppError> {
    let current_state = state.current_state().await;
    serde_json::to_string(&current_state).map_err(|e| AppError::sync(&e.to_string()))
}
