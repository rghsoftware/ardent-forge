use crate::error::AppError;
use crate::rest_timer::RestTimerState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn start_rest_timer(
    seconds: u32,
    state: State<'_, RestTimerState>,
    app: AppHandle,
) -> Result<(), AppError> {
    state.start(seconds, app).await;
    Ok(())
}

#[tauri::command]
pub async fn skip_rest_timer(
    state: State<'_, RestTimerState>,
    app: AppHandle,
) -> Result<(), AppError> {
    state.skip(&app).await;
    Ok(())
}

#[tauri::command]
pub async fn adjust_rest_timer(
    delta: i32,
    state: State<'_, RestTimerState>,
) -> Result<(), AppError> {
    state.adjust(delta).await;
    Ok(())
}
