use tauri::{AppHandle, State};

use crate::crypto::EncryptedFileDetectionResult;
use crate::errors::AppError;
use crate::models::decryption::{
    DecryptionOperationResult, DecryptionRequest, DecryptionResult, StartDecryptionBatchRequest,
};
use crate::models::EncryptionOperation;
use crate::operations::OperationManager;
use crate::services::DecryptionService;

/// Inspects the header and preamble of an encrypted file container without full key derivation.
#[tauri::command]
pub async fn detect_encrypted_file(
    decryption_service: State<'_, DecryptionService>,
    path: String,
) -> Result<EncryptedFileDetectionResult, AppError> {
    decryption_service.detect_encrypted_file(&path)
}

/// Performs single-file streaming authenticated decryption with XChaCha20-Poly1305 and Argon2id.
///
/// Restores the original filename, authenticated size, and extension.
/// Cleans up temporary output files automatically upon any authentication failure or cancellation.
#[tauri::command]
pub async fn decrypt_file(
    decryption_service: State<'_, DecryptionService>,
    request: DecryptionRequest,
) -> Result<DecryptionResult, AppError> {
    decryption_service.decrypt_file(request, None, None)
}

/// Starts a batch decryption operation over multiple files with controlled concurrency and streaming progress.
#[tauri::command]
pub async fn start_decryption_batch(
    app_handle: AppHandle,
    operation_manager: State<'_, OperationManager>,
    request: StartDecryptionBatchRequest,
) -> Result<DecryptionOperationResult, AppError> {
    operation_manager.start_decryption_batch(Some(&app_handle), request)
}

/// Cancels an individual active or queued decryption job.
#[tauri::command]
pub async fn cancel_decryption_job(
    operation_manager: State<'_, OperationManager>,
    operation_id: String,
    job_id: String,
) -> Result<(), AppError> {
    operation_manager.cancel_job(&operation_id, &job_id)
}

/// Cancels an entire running or queued batch decryption operation.
#[tauri::command]
pub async fn cancel_decryption_operation(
    operation_manager: State<'_, OperationManager>,
    operation_id: String,
) -> Result<(), AppError> {
    operation_manager.cancel_operation(&operation_id)
}

/// Retrieves the current snapshot and progress metrics of a decryption operation.
#[tauri::command]
pub async fn get_decryption_operation_status(
    operation_manager: State<'_, OperationManager>,
    operation_id: String,
) -> Result<EncryptionOperation, AppError> {
    operation_manager.get_operation_status(&operation_id)
}
