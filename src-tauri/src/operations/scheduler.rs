use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use chrono::Utc;
use log::{error, info, warn};

use crate::crypto::{
    derive_key_argon2id, encrypt_file_stream, Argon2ParamsConfig, DEFAULT_CHUNK_SIZE, Salt,
};
use crate::errors::AppError;
use crate::models::{
    BatchProgressEvent, EncryptionJob, EncryptionOperation, EncryptionOperationResult,
    JobProgressEvent, JobResult, JobStatus, OperationStatus, OperationType, OutputConflictStatus,
};
use crate::operations::cancellation::CancellationRegistry;
use crate::operations::registry::OperationRegistry;
use crate::services::file_service::FileService;
use crate::utils::paths::generate_encrypted_output_path;
use crate::utils::temp::{cleanup_temp_file_path, prepare_temp_output_path};

/// Event dispatcher trait to decouple event emission from Tauri app handles.
pub trait ProgressEventEmitter: Send + Sync {
    fn emit_job_progress(&self, event: &JobProgressEvent);
    fn emit_batch_progress(&self, event: &BatchProgressEvent);
    fn emit_operation_status(&self, event: &BatchProgressEvent);
}

/// No-op emitter for unit tests and headless execution.
pub struct NoopEventEmitter;
impl ProgressEventEmitter for NoopEventEmitter {
    fn emit_job_progress(&self, _event: &JobProgressEvent) {}
    fn emit_batch_progress(&self, _event: &BatchProgressEvent) {}
    fn emit_operation_status(&self, _event: &BatchProgressEvent) {}
}

/// Tauri event emitter implementation.
pub struct TauriEventEmitter {
    app_handle: tauri::AppHandle,
}

impl TauriEventEmitter {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self { app_handle }
    }
}

impl ProgressEventEmitter for TauriEventEmitter {
    fn emit_job_progress(&self, event: &JobProgressEvent) {
        use tauri::Emitter;
        let _ = self.app_handle.emit("encryption://job-status", event);
    }

    fn emit_batch_progress(&self, event: &BatchProgressEvent) {
        use tauri::Emitter;
        let _ = self.app_handle.emit("encryption://progress", event);
    }

    fn emit_operation_status(&self, event: &BatchProgressEvent) {
        use tauri::Emitter;
        let _ = self.app_handle.emit("encryption://operation-status", event);
    }
}

/// Orchestrates batch encryption jobs with controlled concurrency.
pub struct JobScheduler {
    registry: Arc<OperationRegistry>,
    cancellation: Arc<CancellationRegistry>,
    file_service: Arc<FileService>,
}

impl JobScheduler {
    pub fn new(
        registry: Arc<OperationRegistry>,
        cancellation: Arc<CancellationRegistry>,
        file_service: Arc<FileService>,
    ) -> Self {
        Self {
            registry,
            cancellation,
            file_service,
        }
    }

    /// Executes an entire encryption operation across a bounded worker pool.
    /// CRITICAL: `password` is used in memory for key derivation and never persisted or stored in state.
    pub fn execute_operation(
        &self,
        mut operation: EncryptionOperation,
        password: &str,
        output_directory: Option<String>,
        overwrite: Option<bool>,
        concurrency: usize,
        emitter: Arc<dyn ProgressEventEmitter>,
    ) -> Result<EncryptionOperationResult, AppError> {
        let op_id = operation.operation_id.clone();
        let start_time = Instant::now();
        let started_at_str = Utc::now().to_rfc3339();

        info!(
            "Starting batch operation {} with {} files (concurrency = {})",
            op_id, operation.total_files, concurrency
        );

        // Register cancellation token for the operation
        let op_cancel_token = self.cancellation.register_operation(&op_id);

        // Register cancellation tokens for all jobs
        for job in &operation.jobs {
            self.cancellation.register_job(&op_id, &job.job_id);
        }

        operation.started_at = Some(started_at_str.clone());
        let _ = operation.status.transition_to(OperationStatus::Running);
        self.registry.insert_operation(operation.clone(), OperationType::Encrypt);

        // Emit initial operation status
        emitter.emit_operation_status(&BatchProgressEvent {
            operation_id: op_id.clone(),
            total_files: operation.total_files,
            completed_files: 0,
            failed_files: 0,
            cancelled_files: 0,
            skipped_files: 0,
            total_bytes: operation.total_bytes,
            processed_bytes: 0,
            percentage: 0.0,
            status: OperationStatus::Running,
        });

        // Bounded concurrency execution via worker threads
        let job_queue = Arc::new(Mutex::new(VecDeque::from(operation.jobs.clone())));
        let actual_concurrency = concurrency.clamp(1, 8);
        let mut worker_handles = Vec::with_capacity(actual_concurrency);

        let shared_password = Arc::new(password.to_string());
        let shared_output_dir = Arc::new(output_directory);

        for worker_idx in 0..actual_concurrency {
            let queue_clone = Arc::clone(&job_queue);
            let registry_clone = Arc::clone(&self.registry);
            let cancellation_clone = Arc::clone(&self.cancellation);
            let file_service_clone = Arc::clone(&self.file_service);
            let emitter_clone = Arc::clone(&emitter);
            let password_clone = Arc::clone(&shared_password);
            let output_dir_clone = Arc::clone(&shared_output_dir);
            let op_id_clone = op_id.clone();
            let op_cancel_clone = Arc::clone(&op_cancel_token);

            let handle = thread::spawn(move || {
                loop {
                    // Check if operation level cancellation has occurred
                    if op_cancel_clone.load(std::sync::atomic::Ordering::SeqCst) {
                        info!("Worker {} noticed operation cancellation, cancelling remaining jobs", worker_idx);
                        // Mark any remaining jobs in queue as cancelled
                        while let Ok(mut q) = queue_clone.lock() {
                            if let Some(mut job) = q.pop_front() {
                                let _ = job.status.transition_to(JobStatus::Cancelled);
                                job.stage = "Cancelled".to_string();
                                let jid = job.job_id.clone();
                                let ip = job.input_path.clone();
                                registry_clone.update_job(&op_id_clone, &jid, |j| {
                                    let _ = j.status.transition_to(JobStatus::Cancelled);
                                    j.stage = "Cancelled".to_string();
                                });
                                emitter_clone.emit_job_progress(&JobProgressEvent {
                                    operation_id: op_id_clone.clone(),
                                    job_id: jid,
                                    input_path: ip,
                                    bytes_processed: 0,
                                    total_bytes: job.total_bytes,
                                    percentage: 0.0,
                                    stage: "Cancelled".to_string(),
                                    status: JobStatus::Cancelled,
                                    output_path: None,
                                    error: None,
                                });
                            } else {
                                break;
                            }
                        }
                        break;
                    }

                    // Pull next job from queue
                    let next_job = {
                        let mut q = queue_clone.lock().map_err(|_| AppError::QueueError("Failed to lock job queue".to_string()));
                        match q {
                            Ok(mut guard) => guard.pop_front(),
                            Err(_) => break,
                        }
                    };

                    let job = match next_job {
                        Some(j) => j,
                        None => break, // Queue is empty, worker finishes
                    };

                    Self::process_single_job(
                        &op_id_clone,
                        job,
                        &password_clone,
                        output_dir_clone.as_deref(),
                        overwrite,
                        &registry_clone,
                        &cancellation_clone,
                        &file_service_clone,
                        &emitter_clone,
                    );
                }
            });

            worker_handles.push(handle);
        }

        // Wait for all workers to finish
        for handle in worker_handles {
            if let Err(e) = handle.join() {
                error!("Worker thread panicked: {:?}", e);
            }
        }

        // Recalculate final totals in registry
        let mut final_op = self
            .registry
            .recalculate_operation(&op_id)
            .unwrap_or(operation);

        let duration_ms = start_time.elapsed().as_millis() as u64;
        let completed_at_str = Utc::now().to_rfc3339();
        final_op.completed_at = Some(completed_at_str.clone());

        // Construct safe public job results
        let mut job_results = Vec::with_capacity(final_op.jobs.len());
        for job in &final_op.jobs {
            job_results.push(JobResult {
                job_id: job.job_id.clone(),
                input_path: job.input_path.clone(),
                output_path: job.output_path.clone(),
                output_name: job.output_name.clone(),
                status: job.status,
                original_size: job.total_bytes,
                encrypted_size: if job.status == JobStatus::Completed {
                    // Estimate or exact size from filesystem if available
                    job.output_path
                        .as_ref()
                        .and_then(|p| fs::metadata(p).ok().map(|m| m.len()))
                        .unwrap_or(job.processed_bytes)
                } else {
                    0
                },
                duration_ms: job.duration_ms.unwrap_or(0),
                error: job.error.clone(),
            });
        }

        // Record session summary into in-memory registry
        self.registry.record_session_summary(&final_op, OperationType::Encrypt, duration_ms);

        // Emit final terminal events
        emitter.emit_operation_status(&BatchProgressEvent {
            operation_id: op_id.clone(),
            total_files: final_op.total_files,
            completed_files: final_op.completed_files,
            failed_files: final_op.failed_files,
            cancelled_files: final_op.cancelled_files,
            skipped_files: final_op.skipped_files,
            total_bytes: final_op.total_bytes,
            processed_bytes: final_op.processed_bytes,
            percentage: final_op.progress_percentage(),
            status: final_op.status,
        });

        // Cleanup cancellation tokens
        self.cancellation.cleanup_operation(&op_id);

        info!(
            "Batch operation {} finished in {}ms. Status: {:?} (Success: {}, Failed: {}, Cancelled: {}, Skipped: {})",
            op_id, duration_ms, final_op.status, final_op.completed_files, final_op.failed_files, final_op.cancelled_files, final_op.skipped_files
        );

        Ok(EncryptionOperationResult {
            operation_id: op_id,
            status: final_op.status,
            total_files: final_op.total_files,
            successful_files: final_op.completed_files,
            failed_files: final_op.failed_files,
            cancelled_files: final_op.cancelled_files,
            skipped_files: final_op.skipped_files,
            total_bytes: final_op.total_bytes,
            processed_bytes: final_op.processed_bytes,
            duration_ms,
            started_at: started_at_str,
            completed_at: completed_at_str,
            jobs: job_results,
        })
    }

    /// Processes an individual encryption job using the Phase 4 streaming encryption engine.
    fn process_single_job(
        operation_id: &str,
        mut job: EncryptionJob,
        password: &str,
        output_directory: Option<&str>,
        overwrite: Option<bool>,
        registry: &Arc<OperationRegistry>,
        cancellation: &Arc<CancellationRegistry>,
        file_service: &Arc<FileService>,
        emitter: &Arc<dyn ProgressEventEmitter>,
    ) {
        let job_id = job.job_id.clone();
        let input_path_str = job.input_path.clone();
        let input_path = Path::new(&input_path_str);
        let job_start = Instant::now();

        // 1. Check if job or operation was already cancelled
        if cancellation.is_cancelled(operation_id, Some(&job_id)) {
            info!("Job {} was cancelled before starting", job_id);
            let _ = job.status.transition_to(JobStatus::Cancelled);
            job.stage = "Cancelled".to_string();
            registry.update_job(operation_id, &job_id, |j| {
                let _ = j.status.transition_to(JobStatus::Cancelled);
                j.stage = "Cancelled".to_string();
            });
            emitter.emit_job_progress(&JobProgressEvent {
                operation_id: operation_id.to_string(),
                job_id: job_id.clone(),
                input_path: input_path_str,
                bytes_processed: 0,
                total_bytes: job.total_bytes,
                percentage: 0.0,
                stage: "Cancelled".to_string(),
                status: JobStatus::Cancelled,
                output_path: None,
                error: None,
            });
            Self::emit_aggregated_progress(operation_id, registry, emitter);
            return;
        }

        // 2. Stage: Preparing
        let _ = job.status.transition_to(JobStatus::Preparing);
        job.stage = "Preparing".to_string();
        registry.update_job(operation_id, &job_id, |j| {
            let _ = j.status.transition_to(JobStatus::Preparing);
            j.stage = "Preparing".to_string();
        });
        emitter.emit_job_progress(&JobProgressEvent {
            operation_id: operation_id.to_string(),
            job_id: job_id.clone(),
            input_path: input_path_str.clone(),
            bytes_processed: 0,
            total_bytes: job.total_bytes,
            percentage: 0.0,
            stage: "Preparing".to_string(),
            status: JobStatus::Preparing,
            output_path: None,
            error: None,
        });

        // 3. Determine final output path and check conflicts
        let out_dir_path = output_directory.map(Path::new);
        let final_output_path = generate_encrypted_output_path(input_path, out_dir_path, None);
        let output_path_str = final_output_path.to_string_lossy().to_string();
        let output_name = final_output_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("encrypted.enc")
            .to_string();

        if let Ok(conflict) = file_service.check_output_conflict(&input_path_str, &output_path_str) {
            match conflict.status {
                OutputConflictStatus::SameAsInput => {
                    Self::handle_job_failure(
                        operation_id,
                        &job_id,
                        &input_path_str,
                        job.total_bytes,
                        "Output path cannot be identical to source file",
                        registry,
                        emitter,
                    );
                    return;
                }
                OutputConflictStatus::ParentDirectoryMissing => {
                    Self::handle_job_failure(
                        operation_id,
                        &job_id,
                        &input_path_str,
                        job.total_bytes,
                        "Output directory does not exist",
                        registry,
                        emitter,
                    );
                    return;
                }
                OutputConflictStatus::OutputExists => {
                    if overwrite != Some(true) {
                        Self::handle_job_failure(
                            operation_id,
                            &job_id,
                            &input_path_str,
                            job.total_bytes,
                            "Destination file already exists (overwrite disabled)",
                            registry,
                            emitter,
                        );
                        return;
                    }
                }
                _ => {}
            }
        }

        // 4. Prepare temporary output path
        let temp_res = match prepare_temp_output_path(&final_output_path) {
            Ok(res) => res,
            Err(e) => {
                Self::handle_job_failure(
                    operation_id,
                    &job_id,
                    &input_path_str,
                    job.total_bytes,
                    &format!("Failed to create temporary output file: {}", e),
                    registry,
                    emitter,
                );
                return;
            }
        };
        let temp_path = PathBuf::from(&temp_res.temp_path);

        // 5. Generate unique random Salt and derive key (unique per file!)
        let salt = match Salt::generate() {
            Ok(s) => s,
            Err(e) => {
                let _ = cleanup_temp_file_path(&temp_path);
                Self::handle_job_failure(
                    operation_id,
                    &job_id,
                    &input_path_str,
                    job.total_bytes,
                    &format!("Cryptographic salt generation failed: {}", e),
                    registry,
                    emitter,
                );
                return;
            }
        };

        let argon2_params = Argon2ParamsConfig::default();
        let derived_key = match derive_key_argon2id(password, salt.as_bytes(), Some(&argon2_params)) {
            Ok(k) => k,
            Err(e) => {
                let _ = cleanup_temp_file_path(&temp_path);
                Self::handle_job_failure(
                    operation_id,
                    &job_id,
                    &input_path_str,
                    job.total_bytes,
                    &format!("Key derivation failed: {}", e),
                    registry,
                    emitter,
                );
                return;
            }
        };

        // 6. Transition to Encrypting
        let _ = job.status.transition_to(JobStatus::Encrypting);
        job.stage = "Encrypting".to_string();
        job.output_path = Some(output_path_str.clone());
        job.output_name = Some(output_name.clone());
        registry.update_job(operation_id, &job_id, |j| {
            let _ = j.status.transition_to(JobStatus::Encrypting);
            j.stage = "Encrypting".to_string();
            j.output_path = Some(output_path_str.clone());
            j.output_name = Some(output_name.clone());
        });

        // Setup throttled progress callback
        let last_emit_time = Arc::new(Mutex::new(Instant::now()));
        let last_emit_bytes = Arc::new(AtomicU64::new(0));
        let total_bytes = job.total_bytes;

        let registry_for_progress = Arc::clone(registry);
        let emitter_for_progress = Arc::clone(emitter);
        let op_id_for_progress = operation_id.to_string();
        let job_id_for_progress = job_id.clone();
        let input_path_for_progress = input_path_str.clone();

        let mut progress_cb = move |bytes_processed: u64, total: u64| {
            let now = Instant::now();
            let mut last_time = last_emit_time.lock().unwrap();
            let prev_bytes = last_emit_bytes.load(Ordering::Relaxed);
            let byte_diff = bytes_processed.saturating_sub(prev_bytes);
            let time_elapsed = now.duration_since(*last_time);

            // Throttle: emit every 100ms or on >= 1% change or when finished
            let pct_diff = if total > 0 {
                (byte_diff as f64 / total as f64) * 100.0
            } else {
                100.0
            };

            let is_complete = bytes_processed >= total;
            let should_emit = is_complete || time_elapsed >= Duration::from_millis(100) || pct_diff >= 1.0;

            if should_emit {
                *last_time = now;
                last_emit_bytes.store(bytes_processed, Ordering::Relaxed);

                let percentage = if total > 0 {
                    ((bytes_processed as f64 / total as f64) * 100.0).clamp(0.0, 100.0)
                } else {
                    100.0
                };

                registry_for_progress.update_job(&op_id_for_progress, &job_id_for_progress, |j| {
                    j.update_progress(bytes_processed, "Encrypting");
                });

                emitter_for_progress.emit_job_progress(&JobProgressEvent {
                    operation_id: op_id_for_progress.clone(),
                    job_id: job_id_for_progress.clone(),
                    input_path: input_path_for_progress.clone(),
                    bytes_processed,
                    total_bytes: total,
                    percentage,
                    stage: "Encrypting".to_string(),
                    status: JobStatus::Encrypting,
                    output_path: None,
                    error: None,
                });

                Self::emit_aggregated_progress(&op_id_for_progress, &registry_for_progress, &emitter_for_progress);
            }
        };

        // Setup cancellation closure
        let op_id_for_cancel = operation_id.to_string();
        let job_id_for_cancel = job_id.clone();
        let cancellation_for_stream = Arc::clone(cancellation);
        let is_cancelled_cb = move || {
            cancellation_for_stream.is_cancelled(&op_id_for_cancel, Some(&job_id_for_cancel))
        };

        // 7. Stream encryption
        let stream_result = encrypt_file_stream(
            input_path,
            &temp_path,
            &derived_key,
            salt,
            argon2_params,
            DEFAULT_CHUNK_SIZE,
            Some(&mut progress_cb),
            Some(&is_cancelled_cb),
        );

        // 8. Handle stream result
        match stream_result {
            Ok((_bytes_read, _encrypted_size)) => {
                // Stage: Finalizing
                let _ = job.status.transition_to(JobStatus::Finalizing);
                job.stage = "Finalizing".to_string();
                registry.update_job(operation_id, &job_id, |j| {
                    let _ = j.status.transition_to(JobStatus::Finalizing);
                    j.stage = "Finalizing".to_string();
                });

                // Atomic move
                if let Err(e) = Self::atomic_finalize(&temp_path, &final_output_path) {
                    let _ = cleanup_temp_file_path(&temp_path);
                    Self::handle_job_failure(
                        operation_id,
                        &job_id,
                        &input_path_str,
                        total_bytes,
                        &format!("Failed to finalize output file: {}", e),
                        registry,
                        emitter,
                    );
                    return;
                }

                // Stage: Completed
                let duration_ms = job_start.elapsed().as_millis() as u64;
                let _ = job.status.transition_to(JobStatus::Completed);
                job.stage = "Completed".to_string();
                job.processed_bytes = total_bytes;
                job.progress_percentage = 100.0;
                job.duration_ms = Some(duration_ms);
                job.completed_at = Some(Utc::now().to_rfc3339());

                registry.update_job(operation_id, &job_id, |j| {
                    let _ = j.status.transition_to(JobStatus::Completed);
                    j.stage = "Completed".to_string();
                    j.processed_bytes = total_bytes;
                    j.progress_percentage = 100.0;
                    j.duration_ms = Some(duration_ms);
                    j.completed_at = Some(Utc::now().to_rfc3339());
                });

                emitter.emit_job_progress(&JobProgressEvent {
                    operation_id: operation_id.to_string(),
                    job_id: job_id.clone(),
                    input_path: input_path_str,
                    bytes_processed: total_bytes,
                    total_bytes,
                    percentage: 100.0,
                    stage: "Completed".to_string(),
                    status: JobStatus::Completed,
                    output_path: Some(output_path_str),
                    error: None,
                });

                Self::emit_aggregated_progress(operation_id, registry, emitter);
            }
            Err(AppError::Cancelled(_)) => {
                warn!("Job {} was cancelled during encryption streaming", job_id);
                let _ = cleanup_temp_file_path(&temp_path);

                let _ = job.status.transition_to(JobStatus::Cancelled);
                job.stage = "Cancelled".to_string();
                registry.update_job(operation_id, &job_id, |j| {
                    let _ = j.status.transition_to(JobStatus::Cancelled);
                    j.stage = "Cancelled".to_string();
                });

                emitter.emit_job_progress(&JobProgressEvent {
                    operation_id: operation_id.to_string(),
                    job_id: job_id.clone(),
                    input_path: input_path_str,
                    bytes_processed: 0,
                    total_bytes,
                    percentage: 0.0,
                    stage: "Cancelled".to_string(),
                    status: JobStatus::Cancelled,
                    output_path: None,
                    error: None,
                });

                Self::emit_aggregated_progress(operation_id, registry, emitter);
            }
            Err(e) => {
                error!("Job {} failed during streaming: {:?}", job_id, e);
                let _ = cleanup_temp_file_path(&temp_path);
                Self::handle_job_failure(
                    operation_id,
                    &job_id,
                    &input_path_str,
                    total_bytes,
                    &e.to_string(),
                    registry,
                    emitter,
                );
            }
        }
    }

    fn handle_job_failure(
        operation_id: &str,
        job_id: &str,
        input_path: &str,
        total_bytes: u64,
        error_msg: &str,
        registry: &Arc<OperationRegistry>,
        emitter: &Arc<dyn ProgressEventEmitter>,
    ) {
        registry.update_job(operation_id, job_id, |j| {
            let _ = j.status.transition_to(JobStatus::Failed);
            j.stage = "Failed".to_string();
            j.error = Some(error_msg.to_string());
            j.completed_at = Some(Utc::now().to_rfc3339());
        });

        emitter.emit_job_progress(&JobProgressEvent {
            operation_id: operation_id.to_string(),
            job_id: job_id.to_string(),
            input_path: input_path.to_string(),
            bytes_processed: 0,
            total_bytes,
            percentage: 0.0,
            stage: "Failed".to_string(),
            status: JobStatus::Failed,
            output_path: None,
            error: Some(error_msg.to_string()),
        });

        Self::emit_aggregated_progress(operation_id, registry, emitter);
    }

    fn emit_aggregated_progress(
        operation_id: &str,
        registry: &Arc<OperationRegistry>,
        emitter: &Arc<dyn ProgressEventEmitter>,
    ) {
        if let Some(op) = registry.get_operation(operation_id) {
            emitter.emit_batch_progress(&BatchProgressEvent {
                operation_id: operation_id.to_string(),
                total_files: op.total_files,
                completed_files: op.completed_files,
                failed_files: op.failed_files,
                cancelled_files: op.cancelled_files,
                skipped_files: op.skipped_files,
                total_bytes: op.total_bytes,
                processed_bytes: op.processed_bytes,
                percentage: op.progress_percentage(),
                status: op.status,
            });
        }
    }

    fn atomic_finalize(temp_path: &Path, final_path: &Path) -> std::io::Result<()> {
        if let Err(_rename_err) = fs::rename(temp_path, final_path) {
            fs::copy(temp_path, final_path)?;
            let _ = fs::remove_file(temp_path);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_batch_scheduler_multi_file_concurrency() {
        let registry = Arc::new(OperationRegistry::new());
        let cancellation = Arc::new(CancellationRegistry::new());
        let file_service = Arc::new(FileService::new());
        let scheduler = JobScheduler::new(registry.clone(), cancellation.clone(), file_service.clone());

        // Create 3 temporary source files
        let mut file1 = NamedTempFile::new().unwrap();
        file1.write_all(b"Batch file 1 contents").unwrap();
        file1.flush().unwrap();

        let mut file2 = NamedTempFile::new().unwrap();
        file2.write_all(b"Batch file 2 contents").unwrap();
        file2.flush().unwrap();

        let mut file3 = NamedTempFile::new().unwrap();
        file3.write_all(b"Batch file 3 contents").unwrap();
        file3.flush().unwrap();

        let path1 = file1.path().to_str().unwrap().to_string();
        let path2 = file2.path().to_str().unwrap().to_string();
        let path3 = file3.path().to_str().unwrap().to_string();

        let job1 = EncryptionJob::new("op-test".to_string(), path1.clone(), 21);
        let job2 = EncryptionJob::new("op-test".to_string(), path2.clone(), 21);
        let job3 = EncryptionJob::new("op-test".to_string(), path3.clone(), 21);

        let mut op = EncryptionOperation::new(vec![job1, job2, job3]);
        let op_id = op.operation_id.clone();

        let emitter = Arc::new(NoopEventEmitter);
        let result = scheduler
            .execute_operation(op, "BatchPassword123!", None, Some(true), 2, emitter)
            .expect("Batch execution failed");

        assert_eq!(result.operation_id, op_id);
        assert_eq!(result.status, OperationStatus::Completed);
        assert_eq!(result.total_files, 3);
        assert_eq!(result.successful_files, 3);
        assert_eq!(result.failed_files, 0);
        assert_eq!(result.cancelled_files, 0);
    }
}
