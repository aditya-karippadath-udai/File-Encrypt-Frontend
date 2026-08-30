use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use log::{info, warn};

use crate::errors::AppError;
use crate::models::{
    BatchSummary, FileDialogOptions, FileMetadata, FileValidationResult, OutputConflictResult,
    OutputConflictStatus, TempFileResult,
};
use crate::utils::paths::{
    are_same_file, generate_decrypted_output_path, generate_encrypted_output_path,
    is_encrypted_extension, normalize_path,
};
use crate::utils::temp::{cleanup_temp_file_path, prepare_temp_output_path};

pub struct FileService;

impl FileService {
    pub fn new() -> Self {
        Self
    }

    /// Native file dialog picker using `rfd`
    pub fn select_files(
        &self,
        options: Option<FileDialogOptions>,
    ) -> Result<Vec<FileMetadata>, AppError> {
        info!("Opening native file selection dialog");
        let mut dialog = rfd::FileDialog::new();

        if let Some(opts) = &options {
            if let Some(title) = &opts.title {
                dialog = dialog.set_title(title);
            }
            if let Some(default_path) = &opts.default_path {
                dialog = dialog.set_directory(default_path);
            }
            if opts.encrypted_only == Some(true) {
                dialog = dialog.add_filter("Encrypted Archives", &["enc", "aegis", "vault"]);
            }
        }

        let is_multiple = options.as_ref().and_then(|o| o.multiple).unwrap_or(true);

        let selected_paths: Vec<PathBuf> = if is_multiple {
            dialog.pick_files().unwrap_or_default()
        } else {
            dialog.pick_file().map(|p| vec![p]).unwrap_or_default()
        };

        if selected_paths.is_empty() {
            info!("User cancelled file selection dialog");
            return Ok(vec![]);
        }

        let mut results = Vec::new();
        for path in selected_paths {
            let path_str = path.to_string_lossy().to_string();
            match self.get_file_metadata(&path_str) {
                Ok(meta) => results.push(meta),
                Err(err) => {
                    warn!("Failed to get metadata for selected file {}: {:?}", path_str, err);
                }
            }
        }

        Ok(results)
    }

    /// Native directory picker dialog
    pub fn select_output_directory(&self) -> Result<Option<String>, AppError> {
        info!("Opening native output directory selection dialog");
        let dialog = rfd::FileDialog::new().set_title("Select Output Directory");

        if let Some(dir_path) = dialog.pick_folder() {
            let path_str = dir_path.to_string_lossy().to_string();
            self.validate_output_directory(&path_str)?;
            Ok(Some(path_str))
        } else {
            info!("User cancelled directory selection");
            Ok(None)
        }
    }

    /// Safely retrieves metadata for a single file path without reading contents into memory.
    pub fn get_file_metadata(&self, path: &str) -> Result<FileMetadata, AppError> {
        if path.trim().is_empty() {
            return Err(AppError::InvalidPath("File path cannot be empty".to_string()));
        }

        let file_path = Path::new(path);
        if !file_path.exists() {
            return Err(AppError::FileNotFound(format!(
                "The selected file was not found: {}",
                file_path.file_name().unwrap_or_default().to_string_lossy()
            )));
        }

        let fs_metadata = fs::metadata(file_path).map_err(|e| {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                AppError::FileAccessDenied(format!("Access denied to file: {}", path))
            } else {
                AppError::MetadataUnavailable(format!("Could not read file metadata: {}", e))
            }
        })?;

        if fs_metadata.is_dir() {
            return Err(AppError::NotAFile(
                "Selected path is a directory, not a regular file".to_string(),
            ));
        }

        let name = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let extension = file_path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_string());

        let modified_at = fs_metadata.modified().ok().map(|st| {
            let dt: DateTime<Utc> = st.into();
            dt.to_rfc3339()
        });

        let is_encrypted = is_encrypted_extension(file_path);

        Ok(FileMetadata {
            path: path.to_string(),
            name,
            extension,
            size_bytes: fs_metadata.len(),
            is_file: fs_metadata.is_file(),
            is_directory: fs_metadata.is_dir(),
            modified_at,
            is_encrypted,
        })
    }

    /// Validates a single file and returns structured validation status.
    pub fn validate_file(&self, path: &str) -> FileValidationResult {
        match self.get_file_metadata(path) {
            Ok(metadata) => FileValidationResult {
                path: path.to_string(),
                valid: true,
                metadata: Some(metadata),
                error: None,
                error_code: None,
            },
            Err(err) => {
                let (code, msg) = match &err {
                    AppError::FileNotFound(m) => ("FILE_NOT_FOUND", m.clone()),
                    AppError::InvalidPath(m) => ("INVALID_PATH", m.clone()),
                    AppError::NotAFile(m) => ("NOT_A_FILE", m.clone()),
                    AppError::FileAccessDenied(m) => ("FILE_ACCESS_DENIED", m.clone()),
                    AppError::MetadataUnavailable(m) => ("METADATA_UNAVAILABLE", m.clone()),
                    other => ("VALIDATION_ERROR", other.to_string()),
                };

                FileValidationResult {
                    path: path.to_string(),
                    valid: false,
                    metadata: None,
                    error: Some(msg),
                    error_code: Some(code.to_string()),
                }
            }
        }
    }

    /// Validates multiple files independently without failing the entire batch.
    pub fn validate_files(&self, paths: Vec<String>) -> Vec<FileValidationResult> {
        paths.iter().map(|p| self.validate_file(p)).collect()
    }

    /// Computes summary stats for a list of paths, detecting canonical duplicates and invalid items.
    pub fn get_batch_summary(&self, paths: Vec<String>) -> Result<BatchSummary, AppError> {
        let total_files = paths.len();
        let mut valid_files = 0;
        let mut invalid_files = 0;
        let mut duplicate_files = 0;
        let mut total_size_bytes: u64 = 0;

        let mut seen_canonical: HashSet<PathBuf> = HashSet::new();

        for path in &paths {
            let path_buf = Path::new(path);
            let canonical = normalize_path(path_buf);

            if seen_canonical.contains(&canonical) {
                duplicate_files += 1;
                continue;
            }
            seen_canonical.insert(canonical);

            match self.get_file_metadata(path) {
                Ok(meta) => {
                    valid_files += 1;
                    total_size_bytes += meta.size_bytes;
                }
                Err(_) => {
                    invalid_files += 1;
                }
            }
        }

        Ok(BatchSummary {
            total_files,
            valid_files,
            invalid_files,
            duplicate_files,
            total_size_bytes,
        })
    }

    /// Validates that an output directory exists and is accessible.
    pub fn validate_output_directory(&self, path: &str) -> Result<bool, AppError> {
        if path.trim().is_empty() {
            return Err(AppError::InvalidOutputDirectory(
                "Output directory path cannot be empty".to_string(),
            ));
        }

        let dir_path = Path::new(path);
        if !dir_path.exists() {
            return Err(AppError::InvalidOutputDirectory(format!(
                "Output directory does not exist: {}",
                path
            )));
        }

        let fs_metadata = fs::metadata(dir_path).map_err(|e| {
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                AppError::DirectoryAccessDenied(format!(
                    "Permission denied accessing output directory: {}",
                    path
                ))
            } else {
                AppError::InvalidOutputDirectory(format!(
                    "Failed to inspect output directory: {}",
                    e
                ))
            }
        })?;

        if !fs_metadata.is_dir() {
            return Err(AppError::InvalidOutputDirectory(
                "Specified output destination is a file, not a directory".to_string(),
            ));
        }

        Ok(true)
    }

    /// Generates output filename based on operation mode (encrypt/decrypt) and destination folder.
    pub fn generate_output_path(
        &self,
        input_path: &str,
        output_dir: Option<String>,
        mode: &str,
        custom_suffix: Option<String>,
    ) -> Result<String, AppError> {
        let in_path = Path::new(input_path);
        let out_dir_path = output_dir.as_ref().map(|d| Path::new(d.as_str()));

        if let Some(dir) = out_dir_path {
            self.validate_output_directory(&dir.to_string_lossy())?;
        }

        let result_path = if mode == "decrypt" {
            generate_decrypted_output_path(in_path, out_dir_path)
        } else {
            generate_encrypted_output_path(in_path, out_dir_path, custom_suffix.as_deref())
        };

        Ok(result_path.to_string_lossy().to_string())
    }

    /// Detects potential destination collisions or unsafe overwrite conditions.
    pub fn check_output_conflict(
        &self,
        input_path: &str,
        output_path: &str,
    ) -> Result<OutputConflictResult, AppError> {
        let in_p = Path::new(input_path);
        let out_p = Path::new(output_path);

        if output_path.trim().is_empty() {
            return Ok(OutputConflictResult {
                status: OutputConflictStatus::InvalidOutput,
                input_path: input_path.to_string(),
                output_path: output_path.to_string(),
                message: "Output path is empty.".to_string(),
                can_overwrite: false,
            });
        }

        if let Some(parent) = out_p.parent() {
            if !parent.as_os_str().is_empty() && !parent.exists() {
                return Ok(OutputConflictResult {
                    status: OutputConflictStatus::ParentDirectoryMissing,
                    input_path: input_path.to_string(),
                    output_path: output_path.to_string(),
                    message: "Output directory does not exist.".to_string(),
                    can_overwrite: false,
                });
            }
        }

        // Check if output equals input file
        if are_same_file(in_p, out_p) {
            return Ok(OutputConflictResult {
                status: OutputConflictStatus::SameAsInput,
                input_path: input_path.to_string(),
                output_path: output_path.to_string(),
                message: "Output path cannot be identical to the source input file.".to_string(),
                can_overwrite: false,
            });
        }

        // Check if destination file already exists on disk
        if out_p.exists() {
            return Ok(OutputConflictResult {
                status: OutputConflictStatus::OutputExists,
                input_path: input_path.to_string(),
                output_path: output_path.to_string(),
                message: "A file with this name already exists at the output destination."
                    .to_string(),
                can_overwrite: true,
            });
        }

        Ok(OutputConflictResult {
            status: OutputConflictStatus::NoConflict,
            input_path: input_path.to_string(),
            output_path: output_path.to_string(),
            message: "Output path is valid with no conflicts.".to_string(),
            can_overwrite: true,
        })
    }

    /// Prepares temporary output path for atomic processing
    pub fn prepare_temp_output(&self, target_path: &str) -> Result<TempFileResult, AppError> {
        let path = Path::new(target_path);
        prepare_temp_output_path(path)
    }

    /// Cleans up temporary file
    pub fn cleanup_temp_file(&self, temp_path: &str) -> Result<(), AppError> {
        let path = Path::new(temp_path);
        cleanup_temp_file_path(path)
    }
}

impl Default for FileService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    #[test]
    fn test_file_validation_and_metadata() {
        let service = FileService::new();
        let temp_dir = std::env::temp_dir();
        let test_file_path = temp_dir.join("aegis_test_file.txt");

        let mut f = File::create(&test_file_path).unwrap();
        f.write_all(b"Hello Aegis Test").unwrap();

        let path_str = test_file_path.to_string_lossy().to_string();
        let meta = service.get_file_metadata(&path_str).unwrap();

        assert_eq!(meta.name, "aegis_test_file.txt");
        assert_eq!(meta.extension.as_deref(), Some("txt"));
        assert_eq!(meta.size_bytes, 16);
        assert!(!meta.is_encrypted);

        // Missing file test
        let missing = temp_dir.join("aegis_non_existent.txt");
        let validation = service.validate_file(&missing.to_string_lossy());
        assert!(!validation.valid);
        assert_eq!(validation.error_code.as_deref(), Some("FILE_NOT_FOUND"));

        // Clean up
        let _ = fs::remove_file(test_file_path);
    }

    #[test]
    fn test_duplicate_detection() {
        let service = FileService::new();
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("aegis_dup_test.bin");
        File::create(&test_file).unwrap();

        let path_str = test_file.to_string_lossy().to_string();
        let paths = vec![path_str.clone(), path_str.clone()];

        let summary = service.get_batch_summary(paths).unwrap();
        assert_eq!(summary.total_files, 2);
        assert_eq!(summary.valid_files, 1);
        assert_eq!(summary.duplicate_files, 1);

        let _ = fs::remove_file(test_file);
    }

    #[test]
    fn test_output_path_generation_and_conflict() {
        let service = FileService::new();
        let input = "/tmp/sample.docx";

        let enc_out = service
            .generate_output_path(input, None, "encrypt", None)
            .unwrap();
        assert_eq!(enc_out, "/tmp/sample.docx.enc");

        let dec_out = service
            .generate_output_path("/tmp/sample.docx.enc", None, "decrypt", None)
            .unwrap();
        assert_eq!(dec_out, "/tmp/sample.docx");

        // Conflict check: same as input
        let conflict = service.check_output_conflict(input, input).unwrap();
        assert_eq!(conflict.status, OutputConflictStatus::SameAsInput);
        assert!(!conflict.can_overwrite);
    }

    #[test]
    fn test_temporary_paths() {
        let service = FileService::new();
        let temp_dir = std::env::temp_dir();
        let target = temp_dir.join("target_file.enc");

        let temp_res = service
            .prepare_temp_output(&target.to_string_lossy())
            .unwrap();
        assert!(temp_res.temp_path.contains(".aegis_tmp_"));

        // Cleanup
        let cleanup_res = service.cleanup_temp_file(&temp_res.temp_path);
        assert!(cleanup_res.is_ok());
    }
}
