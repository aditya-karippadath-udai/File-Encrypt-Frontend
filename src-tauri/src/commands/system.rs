use log::info;
use tauri::State;

use crate::errors::AppError;
use crate::models::{AppInfoResponse, HealthCheckResponse};
use crate::services::SystemService;
use crate::state::AppState;

#[tauri::command]
pub fn get_app_info(
    state: State<'_, AppState>,
    system_service: State<'_, SystemService>,
) -> Result<AppInfoResponse, AppError> {
    info!("Command invoke: get_app_info");
    system_service.get_app_info(&state)
}

#[tauri::command]
pub fn health_check(
    system_service: State<'_, SystemService>,
) -> Result<HealthCheckResponse, AppError> {
    info!("Command invoke: health_check");
    system_service.health_check()
}
