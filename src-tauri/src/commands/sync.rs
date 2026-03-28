use crate::error::AppError;
use crate::sync::SyncEngine;
use tauri::State;

#[tauri::command]
pub async fn sync_set_auth(
    access_token: String,
    refresh_token: String,
    supabase_url: String,
    supabase_key: String,
    state: State<'_, SyncEngine>,
) -> Result<(), AppError> {
    // refresh_token is stored by the Supabase client in React; passed here for future refresh use
    let _ = refresh_token;
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
    let url = state.supabase_url.read().await.clone();
    let key = state.supabase_key.read().await.clone();
    let token = state.access_token.read().await.clone();

    match (url, key, token) {
        (Some(url), Some(key), Some(token)) => {
            state
                .transition_state(crate::sync::SyncState::Pushing)
                .await;
            crate::sync::push::push_all(&state.pool, &url, &key, &token)
                .await
                .map_err(|e| AppError::sync(&e.to_string()))?;
            state
                .transition_state(crate::sync::SyncState::Idle)
                .await;
        }
        _ => return Err(AppError::sync("Not authenticated")),
    }
    Ok(())
}

#[tauri::command]
pub async fn sync_force_pull(state: State<'_, SyncEngine>) -> Result<(), AppError> {
    let current_state = state.state.read().await.clone();
    match current_state {
        crate::sync::SyncState::Offline | crate::sync::SyncState::AuthRequired => {
            return Err(AppError::sync("Not authenticated for sync"));
        }
        _ => {}
    }
    Ok(())
}

#[tauri::command]
pub async fn sync_get_status(state: State<'_, SyncEngine>) -> Result<String, AppError> {
    let current_state = state.state.read().await.clone();
    serde_json::to_string(&current_state).map_err(|e| AppError::sync(&e.to_string()))
}
