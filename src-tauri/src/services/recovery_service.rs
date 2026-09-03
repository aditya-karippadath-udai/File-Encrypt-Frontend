use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use log::{info, warn};
use serde::{Deserialize, Serialize};

use crate::errors::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaleTempFileInfo {
    pub path: String,
    pub filename: String,
    pub parent_dir: String,
    pub size_bytes: u64,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaleTempDetectionResult {
    pub total_found: usize,
    pub total_size_bytes: u64,
    pub files: Vec<StaleTempFileInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StaleTempCleanupResult {
    pub cleaned_count: usize,
    pub failed_count: usize,
    pub bytes_freed: u64,
    pub cleaned_files: Vec<String>,
    pub errors: Vec<String>,
}

pub struct RecoveryService;

impl RecoveryService {
    pub fn new() -> Self {
        Self
    }

    /// Verifies if a filename strictly matches the Aegis temporary naming convention:
    /// `.aegis_tmp_<uuid_prefix>_<original_name>`
    pub fn is_aegis_temp_file(filename: &str) -> bool {
        filename.starts_with(".aegis_tmp_")
    }

    /// Scans candidate directories for stale Aegis temporary files.
    pub fn detect_stale_temp_files(
        &self,
        target_directories: Option<Vec<String>>,
    ) -> Result<StaleTempDetectionResult, AppError> {
        let mut scanned_dirs: Vec<PathBuf> = Vec::new();

        // 1. Always include system temporary directory
        scanned_dirs.push(std::env::temp_dir());

        // 2. Include any requested output directories
        if let Some(dirs) = target_directories {
            for dir_str in dirs {
                let p = PathBuf::from(dir_str);
                if p.is_dir() && !scanned_dirs.contains(&p) {
                    scanned_dirs.push(p);
                }
            }
        }

        let mut found_files = Vec::new();
        let mut total_size_bytes = 0u64;

        for dir in scanned_dirs {
            let entries = match fs::read_dir(&dir) {
                Ok(e) => e,
                Err(err) => {
                    warn!("Could not read directory {:?} during recovery scan: {}", dir, err);
                    continue;
                }
            };

            for entry in entries.flatten() {
                let file_path = entry.path();
                if !file_path.is_file() {
                    continue;
                }

                let filename = file_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or_default();

                if Self::is_aegis_temp_file(filename) {
                    if let Ok(meta) = fs::metadata(&file_path) {
                        let size = meta.len();
                        let created_at = meta.modified().ok().map(|st| {
                            let dt: DateTime<Utc> = st.into();
                            dt.to_rfc3339()
                        });

                        total_size_bytes += size;
                        found_files.push(StaleTempFileInfo {
                            path: file_path.to_string_lossy().to_string(),
                            filename: filename.to_string(),
                            parent_dir: dir.to_string_lossy().to_string(),
                            size_bytes: size,
                            created_at,
                        });
                    }
                }
            }
        }

        info!(
            "Stale temp detection complete. Found {} stale temporary files ({} bytes)",
            found_files.len(),
            total_size_bytes
        );

        Ok(StaleTempDetectionResult {
            total_found: found_files.len(),
            total_size_bytes,
            files: found_files,
        })
    }

    /// Safely deletes specified temporary files.
    /// STRICT CONSTRAINT: Refuses to delete any file that does not strictly match `.aegis_tmp_*`.
    pub fn cleanup_stale_temp_files(
        &self,
        paths: Vec<String>,
    ) -> Result<StaleTempCleanupResult, AppError> {
        let mut cleaned_files = Vec::new();
        let mut errors = Vec::new();
        let mut bytes_freed = 0u64;
        let mut failed_count = 0;

        for path_str in paths {
            let file_path = Path::new(&path_str);
            let filename = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default();

            // Strict safety validation
            if !Self::is_aegis_temp_file(filename) {
                warn!(
                    "Refusing to delete non-temp file during stale cleanup: {}",
                    path_str
                );
                errors.push(format!(
                    "Refused to delete non-temporary file: {}",
                    filename
                ));
                failed_count += 1;
                continue;
            }

            if !file_path.exists() {
                continue;
            }

            let size = fs::metadata(file_path).map(|m| m.len()).unwrap_or(0);

            match fs::remove_file(file_path) {
                Ok(_) => {
                    info!("Successfully cleaned up stale temporary file: {}", path_str);
                    cleaned_files.push(path_str);
                    bytes_freed += size;
                }
                Err(err) => {
                    warn!("Failed to remove temporary file {}: {}", path_str, err);
                    errors.push(format!("Failed to delete {}: {}", filename, err));
                    failed_count += 1;
                }
            }
        }

        Ok(StaleTempCleanupResult {
            cleaned_count: cleaned_files.len(),
            failed_count,
            bytes_freed,
            cleaned_files,
            errors,
        })
    }
}

impl Default for RecoveryService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_stale_temp_detection_and_cleanup() {
        let dir = tempdir().unwrap();
        let dir_path = dir.path();

        // Create a legitimate stale temp file
        let temp_file = dir_path.join(".aegis_tmp_abcd1234_doc.pdf.enc");
        let mut f = File::create(&temp_file).unwrap();
        f.write_all(b"temporary partial data").unwrap();

        // Create a normal user file that must NOT be touched
        let normal_file = dir_path.join("regular_document.pdf");
        let mut f2 = File::create(&normal_file).unwrap();
        f2.write_all(b"important user data").unwrap();

        let service = RecoveryService::new();
        let detect_res = service
            .detect_stale_temp_files(Some(vec![dir_path.to_string_lossy().to_string()]))
            .unwrap();

        assert!(detect_res.files.iter().any(|f| f.filename == ".aegis_tmp_abcd1234_doc.pdf.enc"));
        assert!(!detect_res.files.iter().any(|f| f.filename == "regular_document.pdf"));

        // Cleanup
        let cleanup_res = service
            .cleanup_stale_temp_files(vec![
                temp_file.to_string_lossy().to_string(),
                normal_file.to_string_lossy().to_string(), // Should be rejected safely!
            ])
            .unwrap();

        assert_eq!(cleanup_res.cleaned_count, 1);
        assert_eq!(cleanup_res.failed_count, 1); // Normal file rejected
        assert!(!temp_file.exists());
        assert!(normal_file.exists()); // Normal file untouched
    }
}
