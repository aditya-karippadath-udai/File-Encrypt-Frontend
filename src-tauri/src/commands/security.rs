use crate::errors::AppError;
use crate::models::{
    KeyDerivationRequest, KeyDerivationResponse, PasswordValidationRequest, PasswordValidationResult,
};
use crate::services::SecurityService;
use tauri::State;

/// Validates password length, character limits, and confirmation matching.
/// Does not log password contents.
#[tauri::command]
pub async fn validate_password(
    security_service: State<'_, SecurityService>,
    request: PasswordValidationRequest,
) -> Result<PasswordValidationResult, AppError> {
    security_service.validate_password(&request)
}

/// Prepares and tests key derivation using Argon2id with a secure random salt.
/// Derives the 32-byte key in memory, safely zeroes it out, and returns safe metadata.
#[tauri::command]
pub async fn prepare_key_derivation(
    security_service: State<'_, SecurityService>,
    request: KeyDerivationRequest,
) -> Result<KeyDerivationResponse, AppError> {
    security_service.prepare_key_derivation(&request)
}
