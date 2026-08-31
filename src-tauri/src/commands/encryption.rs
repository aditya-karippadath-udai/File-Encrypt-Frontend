use crate::errors::AppError;
use crate::models::{EncryptionRequest, EncryptionResult};
use crate::services::EncryptionService;
use tauri::State;

/// Performs single-file streaming authenticated encryption using XChaCha20-Poly1305 and Argon2id.
///
/// Password and key material are managed exclusively in native memory with automatic zeroization.
/// The original file is untouched and safe atomic temporary file creation is enforced.
#[tauri::command]
pub async fn encrypt_file(
    encryption_service: State<'_, EncryptionService>,
    request: EncryptionRequest,
) -> Result<EncryptionResult, AppError> {
    encryption_service.encrypt_file(request, None, None)
}
