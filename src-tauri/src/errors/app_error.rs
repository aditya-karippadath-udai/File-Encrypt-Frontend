use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("File error: {0}")]
    FileError(String),

    #[error("System error: {0}")]
    SystemError(String),

    #[error("Internal service error: {0}")]
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
            AppError::ValidationError(msg) => ("VALIDATION_ERROR", msg.clone()),
            AppError::FileError(msg) => ("FILE_ERROR", msg.clone()),
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
