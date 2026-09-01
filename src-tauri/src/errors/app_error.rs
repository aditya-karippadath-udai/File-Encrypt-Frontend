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

    #[error("Password required: {0}")]
    PasswordRequired(String),

    #[error("Invalid password: {0}")]
    InvalidPassword(String),

    #[error("Password mismatch: {0}")]
    PasswordMismatch(String),

    #[error("Password exceeds maximum allowed length: {0}")]
    PasswordTooLong(String),

    #[error("Key derivation failed: {0}")]
    KeyDerivationFailed(String),

    #[error("Random generation failed: {0}")]
    RandomGenerationFailed(String),

    #[error("Invalid cryptographic configuration: {0}")]
    InvalidCryptoConfiguration(String),

    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("Invalid encryption request: {0}")]
    InvalidEncryptionRequest(String),

    #[error("Header creation failed: {0}")]
    HeaderCreationFailed(String),

    #[error("Header write failed: {0}")]
    HeaderWriteFailed(String),

    #[error("Invalid chunk configuration: {0}")]
    InvalidChunkConfiguration(String),

    #[error("Cryptographic operation failed: {0}")]
    CryptographicOperationFailed(String),

    #[error("Output write failed: {0}")]
    OutputWriteFailed(String),

    #[error("Finalization failed: {0}")]
    FinalizationFailed(String),

    #[error("Operation cancelled: {0}")]
    Cancelled(String),

    #[error("Operation not found: {0}")]
    OperationNotFound(String),

    #[error("Job not found: {0}")]
    JobNotFound(String),

    #[error("Invalid operation state: {0}")]
    InvalidOperationState(String),

    #[error("Invalid job state: {0}")]
    InvalidJobState(String),

    #[error("Operation already running: {0}")]
    OperationAlreadyRunning(String),

    #[error("Operation was cancelled: {0}")]
    OperationCancelled(String),

    #[error("Job was cancelled: {0}")]
    JobCancelled(String),

    #[error("Queue error: {0}")]
    QueueError(String),

    #[error("Scheduler error: {0}")]
    SchedulerError(String),

    #[error("Progress emission failed: {0}")]
    ProgressEmissionFailed(String),

    #[error("Invalid concurrency limit: {0}")]
    ConcurrencyLimitInvalid(String),

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
            AppError::PasswordRequired(msg) => ("PASSWORD_REQUIRED", msg.clone()),
            AppError::InvalidPassword(msg) => ("INVALID_PASSWORD", msg.clone()),
            AppError::PasswordMismatch(msg) => ("PASSWORD_MISMATCH", msg.clone()),
            AppError::PasswordTooLong(msg) => ("PASSWORD_TOO_LONG", msg.clone()),
            AppError::KeyDerivationFailed(msg) => ("KEY_DERIVATION_FAILED", msg.clone()),
            AppError::RandomGenerationFailed(msg) => ("RANDOM_GENERATION_FAILED", msg.clone()),
            AppError::InvalidCryptoConfiguration(msg) => ("INVALID_CRYPTO_CONFIGURATION", msg.clone()),
            AppError::EncryptionFailed(msg) => ("ENCRYPTION_FAILED", msg.clone()),
            AppError::InvalidEncryptionRequest(msg) => ("INVALID_ENCRYPTION_REQUEST", msg.clone()),
            AppError::HeaderCreationFailed(msg) => ("HEADER_CREATION_FAILED", msg.clone()),
            AppError::HeaderWriteFailed(msg) => ("HEADER_WRITE_FAILED", msg.clone()),
            AppError::InvalidChunkConfiguration(msg) => ("INVALID_CHUNK_CONFIGURATION", msg.clone()),
            AppError::CryptographicOperationFailed(msg) => ("CRYPTOGRAPHIC_OPERATION_FAILED", msg.clone()),
            AppError::OutputWriteFailed(msg) => ("OUTPUT_WRITE_FAILED", msg.clone()),
            AppError::FinalizationFailed(msg) => ("FINALIZATION_FAILED", msg.clone()),
            AppError::Cancelled(msg) => ("CANCELLED", msg.clone()),
            AppError::OperationNotFound(msg) => ("OPERATION_NOT_FOUND", msg.clone()),
            AppError::JobNotFound(msg) => ("JOB_NOT_FOUND", msg.clone()),
            AppError::InvalidOperationState(msg) => ("INVALID_OPERATION_STATE", msg.clone()),
            AppError::InvalidJobState(msg) => ("INVALID_JOB_STATE", msg.clone()),
            AppError::OperationAlreadyRunning(msg) => ("OPERATION_ALREADY_RUNNING", msg.clone()),
            AppError::OperationCancelled(msg) => ("OPERATION_CANCELLED", msg.clone()),
            AppError::JobCancelled(msg) => ("JOB_CANCELLED", msg.clone()),
            AppError::QueueError(msg) => ("QUEUE_ERROR", msg.clone()),
            AppError::SchedulerError(msg) => ("SCHEDULER_ERROR", msg.clone()),
            AppError::ProgressEmissionFailed(msg) => ("PROGRESS_EMISSION_FAILED", msg.clone()),
            AppError::ConcurrencyLimitInvalid(msg) => ("CONCURRENCY_LIMIT_INVALID", msg.clone()),
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
