use log::info;

use crate::errors::AppError;
use crate::models::recovery::{StaleCleanupResult, StaleTempFile};
use crate::services::RecoveryService;

#[tauri::command]
pub fn detect_stale_temp_files(
    directories: Vec<String>,
    max_age_secs: Option<u64>,
) -> Result<Vec<StaleTempFile>, AppError> {
    info!("Command invoke: detect_stale_temp_files (directories: {})", directories.len());
    let dirs: Vec<&str> = directories.iter().map(|s| s.as_str()).collect();
    RecoveryService::detect_stale_temp_files(&dirs, max_age_secs)
}

#[tauri::command]
pub fn cleanup_stale_temp_files(
    file_paths: Vec<String>,
) -> Result<StaleCleanupResult, AppError> {
    info!("Command invoke: cleanup_stale_temp_files (count: {})", file_paths.len());
    let paths: Vec<&str> = file_paths.iter().map(|s| s.as_str()).collect();
    Ok(RecoveryService::cleanup_stale_temp_files(&paths))
}
