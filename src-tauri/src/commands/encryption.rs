use log::{error, info};
use tauri::{AppHandle, State};

use crate::errors::AppError;
use crate::models::{
    EncryptionOperation, EncryptionOperationResult, EncryptionRequest, EncryptionResult,
    StartEncryptionBatchRequest,
};
use crate::operations::OperationManager;
use crate::services::EncryptionService;

/// Performs single-file streaming authenticated encryption using XChaCha20-Poly1305 and Argon2id.
///
/// Password and key material are managed exclusively in native memory with automatic zeroization.
/// The original file is untouched and safe atomic temporary file creation is enforced.
#[tauri::command]
pub async fn encrypt_file(
    encryption_service: State<'_, EncryptionService>,
    request: EncryptionRequest,
) -> Result<EncryptionResult, AppError> {
    info!(
        "Command invoke: encrypt_file for input_path: '{}'",
        request.input_path
    );
    match encryption_service.encrypt_file(request, None, None) {
        Ok(result) => {
            info!(
                "Command encrypt_file completed successfully for: '{}'",
                result.output_path
            );
            Ok(result)
        }
        Err(err) => {
            error!("Command encrypt_file failed: {:?}", err);
            Err(err)
        }
    }
}

/// Starts a batch encryption operation over multiple files with controlled concurrency and streaming progress.
#[tauri::command]
pub async fn start_encryption_batch(
    app_handle: AppHandle,
    operation_manager: State<'_, OperationManager>,
    request: StartEncryptionBatchRequest,
) -> Result<EncryptionOperationResult, AppError> {
    info!(
        "Command invoke: start_encryption_batch with {} files",
        request.input_files.len()
    );
    operation_manager.start_batch(Some(&app_handle), request)
}

/// Cancels an individual active or queued encryption job.
#[tauri::command]
pub async fn cancel_encryption_job(
    operation_manager: State<'_, OperationManager>,
    operation_id: String,
    job_id: String,
) -> Result<(), AppError> {
    operation_manager.cancel_job(&operation_id, &job_id)
}

/// Cancels an entire running or queued batch encryption operation.
#[tauri::command]
pub async fn cancel_encryption_operation(
    operation_manager: State<'_, OperationManager>,
    operation_id: String,
) -> Result<(), AppError> {
    operation_manager.cancel_operation(&operation_id)
}

/// Retrieves the current snapshot and progress metrics of an encryption operation.
#[tauri::command]
pub async fn get_encryption_operation_status(
    operation_manager: State<'_, OperationManager>,
    operation_id: String,
) -> Result<EncryptionOperation, AppError> {
    operation_manager.get_operation_status(&operation_id)
}
