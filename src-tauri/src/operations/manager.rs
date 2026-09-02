use std::collections::HashSet;
use std::sync::Arc;
use log::{info, warn};

use crate::errors::AppError;
use crate::models::decryption::{DecryptionOperationResult, StartDecryptionBatchRequest};
use crate::models::{
    EncryptionJob, EncryptionOperation, EncryptionOperationResult, OperationStatus,
    StartEncryptionBatchRequest,
};
use crate::operations::cancellation::CancellationRegistry;
use crate::operations::decryption_scheduler::{
    DecryptionEventEmitter, DecryptionScheduler, NoopDecryptionEventEmitter,
    TauriDecryptionEventEmitter,
};
use crate::operations::registry::OperationRegistry;
use crate::operations::scheduler::{JobScheduler, NoopEventEmitter, ProgressEventEmitter, TauriEventEmitter};
use crate::services::file_service::FileService;
use crate::services::security_service::SecurityService;

/// High-level manager coordinating batch encryption and decryption workflows.
pub struct OperationManager {
    registry: Arc<OperationRegistry>,
    cancellation: Arc<CancellationRegistry>,
    scheduler: Arc<JobScheduler>,
    decryption_scheduler: Arc<DecryptionScheduler>,
    file_service: Arc<FileService>,
    security_service: Arc<SecurityService>,
}

impl OperationManager {
    pub fn new() -> Self {
        let registry = Arc::new(OperationRegistry::new());
        let cancellation = Arc::new(CancellationRegistry::new());
        let file_service = Arc::new(FileService::new());
        let scheduler = Arc::new(JobScheduler::new(
            Arc::clone(&registry),
            Arc::clone(&cancellation),
            Arc::clone(&file_service),
        ));
        let decryption_scheduler = Arc::new(DecryptionScheduler::new(
            Arc::clone(&registry),
            Arc::clone(&cancellation),
            Arc::clone(&file_service),
        ));
        let security_service = Arc::new(SecurityService::new());

        Self {
            registry,
            cancellation,
            scheduler,
            decryption_scheduler,
            file_service,
            security_service,
        }
    }

    /// Validates batch request, creates jobs, and executes the batch encryption operation.
    /// Emits progress events via Tauri if an AppHandle is provided.
    pub fn start_batch(
        &self,
        app_handle: Option<&tauri::AppHandle>,
        request: StartEncryptionBatchRequest,
    ) -> Result<EncryptionOperationResult, AppError> {
        info!("Validating batch request with {} input files", request.input_files.len());

        // 1. Validate Password
        if request.password.is_empty() {
            return Err(AppError::PasswordRequired(
                "Password cannot be empty for batch encryption".to_string(),
            ));
        }

        let pw_validation = self.security_service.validate_password(&request.password);
        if !pw_validation.is_valid {
            return Err(AppError::InvalidPassword(
                pw_validation
                    .errors
                    .first()
                    .cloned()
                    .unwrap_or_else(|| "Password does not meet requirements".to_string()),
            ));
        }

        // 2. Validate Input Files
        if request.input_files.is_empty() {
            return Err(AppError::ValidationError(
                "At least one input file must be selected for batch encryption".to_string(),
            ));
        }

        // Duplicate check
        let mut seen_paths = HashSet::new();
        for path in &request.input_files {
            if !seen_paths.insert(path) {
                return Err(AppError::DuplicateFile(format!(
                    "Duplicate file in batch: {}",
                    path
                )));
            }
        }

        // Validate each file exists and obtain metadata
        let mut jobs = Vec::with_capacity(request.input_files.len());
        for path in &request.input_files {
            let metadata = self.file_service.get_file_metadata(path)?;
            let job = EncryptionJob::new("".to_string(), path.clone(), metadata.size_bytes);
            jobs.push(job);
        }

        // 3. Create Operation Model
        let mut operation = EncryptionOperation::new(jobs);
        let op_id = operation.operation_id.clone();

        // Update job operation_ids
        for job in &mut operation.jobs {
            job.operation_id = op_id.clone();
        }

        // 4. Determine event emitter
        let emitter: Arc<dyn ProgressEventEmitter> = match app_handle {
            Some(handle) => Arc::new(TauriEventEmitter::new(handle.clone())),
            None => Arc::new(NoopEventEmitter),
        };

        // 5. Determine concurrency
        let concurrency = request.concurrency.unwrap_or(2).clamp(1, 8);

        // 6. Execute operation via scheduler
        self.scheduler.execute_operation(
            operation,
            &request.password,
            request.output_directory,
            request.overwrite,
            concurrency,
            emitter,
        )
    }

    /// Validates batch decryption request, creates jobs, and executes the batch decryption operation.
    pub fn start_decryption_batch(
        &self,
        app_handle: Option<&tauri::AppHandle>,
        request: StartDecryptionBatchRequest,
    ) -> Result<DecryptionOperationResult, AppError> {
        info!("Validating batch decryption request with {} input files", request.input_files.len());

        // 1. Validate Password
        if request.password.is_empty() {
            return Err(AppError::PasswordRequired(
                "Password cannot be empty for batch decryption".to_string(),
            ));
        }

        // 2. Validate Input Files
        if request.input_files.is_empty() {
            return Err(AppError::ValidationError(
                "At least one input file must be selected for batch decryption".to_string(),
            ));
        }

        // Duplicate check
        let mut seen_paths = HashSet::new();
        for path in &request.input_files {
            if !seen_paths.insert(path) {
                return Err(AppError::DuplicateFile(format!(
                    "Duplicate file in decryption batch: {}",
                    path
                )));
            }
        }

        // Validate each file exists and get sizes
        let mut jobs = Vec::with_capacity(request.input_files.len());
        for path in &request.input_files {
            let metadata = self.file_service.get_file_metadata(path)?;
            let job = EncryptionJob::new("".to_string(), path.clone(), metadata.size_bytes);
            jobs.push(job);
        }

        // 3. Create Operation Model
        let mut operation = EncryptionOperation::new(jobs);
        let op_id = operation.operation_id.clone();

        for job in &mut operation.jobs {
            job.operation_id = op_id.clone();
        }

        // 4. Determine event emitter
        let emitter: Arc<dyn DecryptionEventEmitter> = match app_handle {
            Some(handle) => Arc::new(TauriDecryptionEventEmitter::new(handle.clone())),
            None => Arc::new(NoopDecryptionEventEmitter),
        };

        let concurrency = request.concurrency.unwrap_or(2).clamp(1, 8);

        // 5. Execute decryption batch via decryption scheduler
        self.decryption_scheduler.execute_operation(
            operation,
            &request.password,
            request.output_directory,
            request.overwrite,
            concurrency,
            emitter,
        )
    }

    /// Cancels an individual job in an operation.
    pub fn cancel_job(&self, operation_id: &str, job_id: &str) -> Result<(), AppError> {
        info!("Cancelling job {} in operation {}", job_id, operation_id);
        let cancelled = self.cancellation.cancel_job(operation_id, job_id);
        if !cancelled {
            warn!("Job {} was not active or already finished", job_id);
        }
        Ok(())
    }

    /// Cancels an entire batch operation.
    pub fn cancel_operation(&self, operation_id: &str) -> Result<(), AppError> {
        info!("Cancelling entire operation {}", operation_id);
        let cancelled = self.cancellation.cancel_operation(operation_id);
        if !cancelled {
            warn!("Operation {} was not active or already finished", operation_id);
        }
        Ok(())
    }

    /// Retrieves current snapshot of an operation from the registry.
    pub fn get_operation_status(&self, operation_id: &str) -> Result<EncryptionOperation, AppError> {
        self.registry
            .get_operation(operation_id)
            .ok_or_else(|| AppError::OperationNotFound(format!("Operation {} not found", operation_id)))
    }
}

impl Default for OperationManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_operation_manager_batch_flow() {
        let manager = OperationManager::new();

        let mut file1 = NamedTempFile::new().unwrap();
        file1.write_all(b"File 1 content").unwrap();
        file1.flush().unwrap();

        let mut file2 = NamedTempFile::new().unwrap();
        file2.write_all(b"File 2 content").unwrap();
        file2.flush().unwrap();

        let req = StartEncryptionBatchRequest {
            input_files: vec![
                file1.path().to_str().unwrap().to_string(),
                file2.path().to_str().unwrap().to_string(),
            ],
            output_directory: None,
            password: "StrongBatchPassword123!".to_string(),
            concurrency: Some(2),
            overwrite: Some(true),
        };

        let result = manager.start_batch(None, req).expect("Batch failed");
        assert_eq!(result.total_files, 2);
        assert_eq!(result.successful_files, 2);
        assert_eq!(result.failed_files, 0);
        assert_eq!(result.status, OperationStatus::Completed);
    }
}
