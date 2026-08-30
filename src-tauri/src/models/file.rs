use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub path: String,
    pub name: String,
    pub extension: Option<String>,
    pub size_bytes: u64,
    pub is_file: bool,
    pub is_directory: bool,
    pub modified_at: Option<String>,
    pub is_encrypted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileValidationResult {
    pub path: String,
    pub valid: bool,
    pub metadata: Option<FileMetadata>,
    pub error: Option<String>,
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchSummary {
    pub total_files: usize,
    pub valid_files: usize,
    pub invalid_files: usize,
    pub duplicate_files: usize,
    pub total_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum OutputConflictStatus {
    NoConflict,
    OutputExists,
    SameAsInput,
    InvalidOutput,
    ParentDirectoryMissing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputConflictResult {
    pub status: OutputConflictStatus,
    pub input_path: String,
    pub output_path: String,
    pub message: String,
    pub can_overwrite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempFileResult {
    pub temp_path: String,
    pub target_path: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDialogOptions {
    pub multiple: Option<bool>,
    pub encrypted_only: Option<bool>,
    pub title: Option<String>,
    pub default_path: Option<String>,
}
