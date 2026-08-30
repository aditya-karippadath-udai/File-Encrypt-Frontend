use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

use crate::errors::AppError;
use crate::models::TempFileResult;

/// Generates a safe temporary path in the target file's parent folder.
/// Pattern: `.tmp_<uuid>_<original_name>`
pub fn prepare_temp_output_path(target_path: &Path) -> Result<TempFileResult, AppError> {
    let parent = match target_path.parent() {
        Some(p) if p.as_os_str().is_empty() => Path::new("."),
        Some(p) => p,
        None => Path::new("."),
    };

    if !parent.exists() {
        return Err(AppError::InvalidOutputDirectory(
            "Output parent directory does not exist".to_string(),
        ));
    }

    let file_name = target_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("output");

    let unique_id = Uuid::new_v4().simple().to_string();
    let temp_name = format!(".aegis_tmp_{}_{}", &unique_id[..8], file_name);
    let temp_path = parent.join(temp_name);

    Ok(TempFileResult {
        temp_path: temp_path.to_string_lossy().to_string(),
        target_path: target_path.to_string_lossy().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Safely removes a temporary file if it exists on disk.
pub fn cleanup_temp_file_path(temp_path: &Path) -> Result<(), AppError> {
    if temp_path.exists() {
        fs::remove_file(temp_path).map_err(|e| {
            AppError::TemporaryFileError(format!("Failed to remove temporary file: {}", e))
        })?;
    }
    Ok(())
}
