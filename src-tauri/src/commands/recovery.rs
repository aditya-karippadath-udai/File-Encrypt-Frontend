use log::info;
use tauri::State;

use crate::errors::AppError;
use crate::services::recovery_service::{
    RecoveryService, StaleTempCleanupResult, StaleTempDetectionResult,
};

#[tauri::command]
pub fn detect_stale_temp_files(
    directories: Option<Vec<String>>,
    recovery_service: State<'_, RecoveryService>,
) -> Result<StaleTempDetectionResult, AppError> {
    info!("Command invoke: detect_stale_temp_files");
    recovery_service.detect_stale_temp_files(directories)
}

#[tauri::command]
pub fn cleanup_stale_temp_files(
    file_paths: Option<Vec<String>>,
    paths: Option<Vec<String>>,
    recovery_service: State<'_, RecoveryService>,
) -> Result<StaleTempCleanupResult, AppError> {
    let all_paths = file_paths.or(paths).unwrap_or_default();
    info!("Command invoke: cleanup_stale_temp_files (count: {})", all_paths.len());
    recovery_service.cleanup_stale_temp_files(all_paths)
}
