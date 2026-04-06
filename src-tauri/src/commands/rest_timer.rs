use crate::error::AppError;
use crate::rest_timer::RestTimerState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn start_rest_timer(
    seconds: u32,
    exercise_name: Option<String>,
    set_number: Option<u32>,
    state: State<'_, RestTimerState>,
    app: AppHandle,
) -> Result<(), AppError> {
    start_rest_timer_inner(seconds, exercise_name, set_number, state.inner(), app).await
}

pub(crate) async fn start_rest_timer_inner(
    seconds: u32,
    exercise_name: Option<String>,
    set_number: Option<u32>,
    state: &RestTimerState,
    app: AppHandle,
) -> Result<(), AppError> {
    state.start(seconds, app, exercise_name, set_number).await;
    Ok(())
}

#[tauri::command]
pub async fn skip_rest_timer(
    state: State<'_, RestTimerState>,
    app: AppHandle,
) -> Result<(), AppError> {
    skip_rest_timer_inner(state.inner(), app).await
}

pub(crate) async fn skip_rest_timer_inner(
    state: &RestTimerState,
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
    adjust_rest_timer_inner(delta, state.inner()).await
}

pub(crate) async fn adjust_rest_timer_inner(
    delta: i32,
    state: &RestTimerState,
) -> Result<(), AppError> {
    state.adjust(delta).await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn adjust_rest_timer_succeeds_when_idle() {
        let state = RestTimerState::new();
        let result = adjust_rest_timer_inner(30, &state).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn adjust_rest_timer_negative_delta_succeeds() {
        let state = RestTimerState::new();
        let result = adjust_rest_timer_inner(-15, &state).await;
        assert!(result.is_ok());
    }
}
