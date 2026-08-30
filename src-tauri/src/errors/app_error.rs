use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Path is not a regular file: {0}")]
    NotAFile(String),

    #[error("File access denied: {0}")]
    FileAccessDenied(String),

    #[error("Directory access denied: {0}")]
    DirectoryAccessDenied(String),

    #[error("Output conflict: {0}")]
    OutputConflict(String),

    #[error("Invalid output directory: {0}")]
    InvalidOutputDirectory(String),

    #[error("Duplicate file in batch: {0}")]
    DuplicateFile(String),

    #[error("Metadata unavailable: {0}")]
    MetadataUnavailable(String),

    #[error("Temporary file error: {0}")]
    TemporaryFileError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("System error: {0}")]
    SystemError(String),

    #[error("Internal error: {0}")]
    InternalError(String),

    #[error("Service unavailable: {0}")]
    Unavailable(String),
}

#[derive(Serialize)]
pub struct SerializedAppError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let (code, message) = match self {
            AppError::FileNotFound(msg) => ("FILE_NOT_FOUND", msg.clone()),
            AppError::InvalidPath(msg) => ("INVALID_PATH", msg.clone()),
            AppError::NotAFile(msg) => ("NOT_A_FILE", msg.clone()),
            AppError::FileAccessDenied(msg) => ("FILE_ACCESS_DENIED", msg.clone()),
            AppError::DirectoryAccessDenied(msg) => ("DIRECTORY_ACCESS_DENIED", msg.clone()),
            AppError::OutputConflict(msg) => ("OUTPUT_CONFLICT", msg.clone()),
            AppError::InvalidOutputDirectory(msg) => ("INVALID_OUTPUT_DIRECTORY", msg.clone()),
            AppError::DuplicateFile(msg) => ("DUPLICATE_FILE", msg.clone()),
            AppError::MetadataUnavailable(msg) => ("METADATA_UNAVAILABLE", msg.clone()),
            AppError::TemporaryFileError(msg) => ("TEMPORARY_FILE_ERROR", msg.clone()),
            AppError::ValidationError(msg) => ("VALIDATION_ERROR", msg.clone()),
            AppError::SystemError(msg) => ("SYSTEM_ERROR", msg.clone()),
            AppError::InternalError(msg) => ("INTERNAL_ERROR", msg.clone()),
            AppError::Unavailable(msg) => ("SERVICE_UNAVAILABLE", msg.clone()),
        };

        let err_struct = SerializedAppError {
            code: code.to_string(),
            message,
            details: None,
        };

        err_struct.serialize(serializer)
    }
}
