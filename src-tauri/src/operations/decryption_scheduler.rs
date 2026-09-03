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
    decrypt_file_stream, derive_key_argon2id, recover_authenticated_metadata,
    DecryptionProgressCallback, EncryptedFileHeader, CURRENT_FORMAT_VERSION,
};
use crate::errors::AppError;
use crate::models::decryption::{
    DecryptionJobProgressPayload, DecryptionOperationResult, DecryptionProgressPayload,
};
use crate::models::operation::{
    BatchJobStatus, BatchOperationStatus, EncryptionJob, EncryptionOperation, JobResultItem,
    OperationType,
};
use crate::operations::cancellation::CancellationRegistry;
use crate::operations::registry::OperationRegistry;
use crate::services::file_service::FileService;
use crate::utils::temp::{cleanup_temp_file_path, prepare_temp_output_path};

/// Event dispatcher trait for decryption events.
pub trait DecryptionEventEmitter: Send + Sync {
    fn emit_job_progress(&self, event: &DecryptionJobProgressPayload);
    fn emit_batch_progress(&self, event: &DecryptionProgressPayload);
    fn emit_operation_status(&self, event: &DecryptionProgressPayload);
}

/// No-op emitter for tests and headless execution.
pub struct NoopDecryptionEventEmitter;
impl DecryptionEventEmitter for NoopDecryptionEventEmitter {
    fn emit_job_progress(&self, _event: &DecryptionJobProgressPayload) {}
    fn emit_batch_progress(&self, _event: &DecryptionProgressPayload) {}
    fn emit_operation_status(&self, _event: &DecryptionProgressPayload) {}
}

/// Tauri IPC decryption event emitter.
pub struct TauriDecryptionEventEmitter {
    app_handle: tauri::AppHandle,
}

impl TauriDecryptionEventEmitter {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self { app_handle }
    }
}

impl DecryptionEventEmitter for TauriDecryptionEventEmitter {
    fn emit_job_progress(&self, event: &DecryptionJobProgressPayload) {
        use tauri::Emitter;
        let _ = self.app_handle.emit("decryption://job-status", event);
    }

    fn emit_batch_progress(&self, event: &DecryptionProgressPayload) {
        use tauri::Emitter;
        let _ = self.app_handle.emit("decryption://progress", event);
    }

    fn emit_operation_status(&self, event: &DecryptionProgressPayload) {
        use tauri::Emitter;
        let _ = self.app_handle.emit("decryption://operation-status", event);
    }
}

/// Orchestrates batch decryption jobs with bounded concurrency and safe fault isolation.
pub struct DecryptionScheduler {
    registry: Arc<OperationRegistry>,
    cancellation: Arc<CancellationRegistry>,
    file_service: Arc<FileService>,
}

impl DecryptionScheduler {
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

    /// Executes a batch decryption operation.
    pub fn execute_operation(
        &self,
        mut operation: EncryptionOperation,
        password: &str,
        output_directory: Option<String>,
        overwrite: Option<bool>,
        concurrency: usize,
        emitter: Arc<dyn DecryptionEventEmitter>,
    ) -> Result<DecryptionOperationResult, AppError> {
        let op_id = operation.operation_id.clone();
        let start_time = Instant::now();
        let started_at_str = Utc::now().to_rfc3339();

        info!(
            "Starting batch decryption operation {} with {} files (concurrency = {})",
            op_id, operation.total_files, concurrency
        );

        // Register cancellation tokens
        let op_cancel_token = self.cancellation.register_operation(&op_id);
        for job in &operation.jobs {
            self.cancellation.register_job(&op_id, &job.job_id);
        }

        operation.started_at = Some(started_at_str.clone());
        let _ = operation.status.transition_to(BatchOperationStatus::Running);
        self.registry.insert_operation(operation.clone(), OperationType::Decrypt);

        // Emit initial operation status
        emitter.emit_operation_status(&DecryptionProgressPayload {
            operation_id: op_id.clone(),
            total_files: operation.total_files,
            completed_files: 0,
            failed_files: 0,
            cancelled_files: 0,
            skipped_files: 0,
            total_bytes: operation.total_bytes,
            processed_bytes: 0,
            percentage: 0.0,
            status: BatchOperationStatus::Running,
        });

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
                    // Check if operation-level cancellation has been signalled
                    if op_cancel_clone.load(std::sync::atomic::Ordering::SeqCst) {
                        info!("Worker {} noticed batch cancellation, draining remaining jobs", worker_idx);
                        while let Ok(mut q) = queue_clone.lock() {
                            if let Some(mut job) = q.pop_front() {
                                let _ = job.status.transition_to(BatchJobStatus::Cancelled);
                                job.stage = "Cancelled".to_string();
                                let jid = job.job_id.clone();
                                let ip = job.input_path.clone();
                                registry_clone.update_job(&op_id_clone, &jid, |j| {
                                    let _ = j.status.transition_to(BatchJobStatus::Cancelled);
                                    j.stage = "Cancelled".to_string();
                                });
                                emitter_clone.emit_job_progress(&DecryptionJobProgressPayload {
                                    operation_id: op_id_clone.clone(),
                                    job_id: jid,
                                    input_path: ip,
                                    bytes_processed: 0,
                                    total_bytes: job.total_bytes,
                                    percentage: 0.0,
                                    stage: "Cancelled".to_string(),
                                    status: BatchJobStatus::Cancelled,
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
                        None => break,
                    };

                    Self::process_single_decryption_job(
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

        // Await all workers
        for handle in worker_handles {
            if let Err(e) = handle.join() {
                error!("Decryption worker thread panicked: {:?}", e);
            }
        }

        // Recalculate final totals
        let mut final_op = self
            .registry
            .recalculate_operation(&op_id)
            .unwrap_or(operation);

        let duration_ms = start_time.elapsed().as_millis() as u64;
        let completed_at_str = Utc::now().to_rfc3339();
        final_op.completed_at = Some(completed_at_str.clone());

        // Construct job results
        let mut job_results = Vec::with_capacity(final_op.jobs.len());
        for job in &final_op.jobs {
            job_results.push(JobResultItem {
                job_id: job.job_id.clone(),
                input_path: job.input_path.clone(),
                output_path: job.output_path.clone(),
                output_name: job.output_name.clone(),
                status: job.status,
                original_size: job.total_bytes,
                encrypted_size: if job.status == BatchJobStatus::Completed {
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
        self.registry.record_session_summary(&final_op, OperationType::Decrypt, duration_ms);

        // Emit final status
        emitter.emit_operation_status(&DecryptionProgressPayload {
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

        self.cancellation.cleanup_operation(&op_id);

        info!(
            "Batch decryption {} completed in {}ms. Status: {:?} (Success: {}, Failed: {}, Cancelled: {}, Skipped: {})",
            op_id, duration_ms, final_op.status, final_op.completed_files, final_op.failed_files, final_op.cancelled_files, final_op.skipped_files
        );

        Ok(DecryptionOperationResult {
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

    fn process_single_decryption_job(
        operation_id: &str,
        mut job: EncryptionJob,
        password: &str,
        output_directory: Option<&str>,
        overwrite: Option<bool>,
        registry: &Arc<OperationRegistry>,
        cancellation: &Arc<CancellationRegistry>,
        file_service: &Arc<FileService>,
        emitter: &Arc<dyn DecryptionEventEmitter>,
    ) {
        let job_id = job.job_id.clone();
        let input_path_str = job.input_path.clone();
        let input_path = Path::new(&input_path_str);
        let job_start = Instant::now();

        // 1. Check cancellation before starting
        if cancellation.is_cancelled(operation_id, Some(&job_id)) {
            info!("Decryption job {} was cancelled before start", job_id);
            let _ = job.status.transition_to(BatchJobStatus::Cancelled);
            job.stage = "Cancelled".to_string();
            registry.update_job(operation_id, &job_id, |j| {
                let _ = j.status.transition_to(BatchJobStatus::Cancelled);
                j.stage = "Cancelled".to_string();
            });
            emitter.emit_job_progress(&DecryptionJobProgressPayload {
                operation_id: operation_id.to_string(),
                job_id: job_id.clone(),
                input_path: input_path_str,
                bytes_processed: 0,
                total_bytes: job.total_bytes,
                percentage: 0.0,
                stage: "Cancelled".to_string(),
                status: BatchJobStatus::Cancelled,
                output_path: None,
                error: None,
            });
            Self::emit_aggregated_progress(operation_id, registry, emitter);
            return;
        }

        // 2. Stage: Preparing
        let _ = job.status.transition_to(BatchJobStatus::Preparing);
        job.stage = "Preparing".to_string();
        registry.update_job(operation_id, &job_id, |j| {
            let _ = j.status.transition_to(BatchJobStatus::Preparing);
            j.stage = "Preparing".to_string();
        });
        emitter.emit_job_progress(&DecryptionJobProgressPayload {
            operation_id: operation_id.to_string(),
            job_id: job_id.clone(),
            input_path: input_path_str.clone(),
            bytes_processed: 0,
            total_bytes: job.total_bytes,
            percentage: 0.0,
            stage: "Preparing".to_string(),
            status: BatchJobStatus::Preparing,
            output_path: None,
            error: None,
        });

        // 3. Open Container and Parse Header
        let mut enc_file = match fs::File::open(input_path) {
            Ok(f) => f,
            Err(e) => {
                Self::handle_job_failure(
                    operation_id,
                    &job_id,
                    &input_path_str,
                    job.total_bytes,
                    &format!("Failed to open encrypted file: {}", e),
                    registry,
                    emitter,
                );
                return;
            }
        };

        let header = match EncryptedFileHeader::read_from(&mut enc_file) {
            Ok(h) => h,
            Err(e) => {
                Self::handle_job_failure(
                    operation_id,
                    &job_id,
                    &input_path_str,
                    job.total_bytes,
                    &format!("Invalid or corrupted container header: {}", e),
                    registry,
                    emitter,
                );
                return;
            }
        };

        if header.version != CURRENT_FORMAT_VERSION {
            Self::handle_job_failure(
                operation_id,
                &job_id,
                &input_path_str,
                job.total_bytes,
                &format!("Unsupported file version: {}", header.version),
                registry,
                emitter,
            );
            return;
        }

        // 4. Derive key and recover metadata
        let derived_key = match derive_key_argon2id(password, &header.salt, &header.argon2_params) {
            Ok(k) => k,
            Err(e) => {
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

        let original_meta = match recover_authenticated_metadata(&header, &derived_key) {
            Ok(m) => m,
            Err(e) => {
                Self::handle_job_failure(
                    operation_id,
                    &job_id,
                    &input_path_str,
                    job.total_bytes,
                    &format!("Authentication failed (wrong password or corrupted header): {}", e),
                    registry,
                    emitter,
                );
                return;
            }
        };

        // 5. Determine destination path
        let final_output_path: PathBuf = if let Some(out_d) = output_directory {
            let mut dir_buf = PathBuf::from(out_d);
            dir_buf.push(&original_meta.file_name);
            dir_buf
        } else {
            let parent = input_path.parent().unwrap_or_else(|| Path::new("."));
            let mut path_buf = parent.to_path_buf();
            path_buf.push(&original_meta.file_name);
            path_buf
        };

        let output_path_str = final_output_path.to_string_lossy().to_string();
        let output_name = final_output_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("decrypted_file")
            .to_string();

        if let Ok(conflict) = file_service.check_output_conflict(&input_path_str, &output_path_str) {
            match conflict.status {
                crate::models::file::OutputConflictStatus::SameAsInput => {
                    Self::handle_job_failure(
                        operation_id,
                        &job_id,
                        &input_path_str,
                        job.total_bytes,
                        "Output path cannot be identical to encrypted input file",
                        registry,
                        emitter,
                    );
                    return;
                }
                crate::models::file::OutputConflictStatus::ParentDirectoryMissing => {
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
                crate::models::file::OutputConflictStatus::OutputExists => {
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

        // 6. Prepare temporary output
        let temp_res = match prepare_temp_output_path(&final_output_path) {
            Ok(res) => res,
            Err(e) => {
                Self::handle_job_failure(
                    operation_id,
                    &job_id,
                    &input_path_str,
                    job.total_bytes,
                    &format!("Failed to prepare temporary output: {}", e),
                    registry,
                    emitter,
                );
                return;
            }
        };
        let temp_path = PathBuf::from(&temp_res.temp_path);

        // 7. Transition to Decrypting
        let _ = job.status.transition_to(BatchJobStatus::Encrypting); // Uses active processing state
        job.stage = "Decrypting".to_string();
        job.output_path = Some(output_path_str.clone());
        job.output_name = Some(output_name.clone());
        registry.update_job(operation_id, &job_id, |j| {
            let _ = j.status.transition_to(BatchJobStatus::Encrypting);
            j.stage = "Decrypting".to_string();
            j.output_path = Some(output_path_str.clone());
            j.output_name = Some(output_name.clone());
        });

        // Setup progress callback
        let last_emit_time = Arc::new(Mutex::new(Instant::now()));
        let last_emit_bytes = Arc::new(AtomicU64::new(0));
        let total_bytes = job.total_bytes;

        let registry_for_progress = Arc::clone(registry);
        let emitter_for_progress = Arc::clone(emitter);
        let op_id_for_progress = operation_id.to_string();
        let job_id_for_progress = job_id.clone();
        let input_path_for_progress = input_path_str.clone();

        let progress_cb: DecryptionProgressCallback = Box::new(move |bytes_processed, total| {
            let now = Instant::now();
            let mut last_time = last_emit_time.lock().unwrap();
            let prev_bytes = last_emit_bytes.load(Ordering::Relaxed);
            let byte_diff = bytes_processed.saturating_sub(prev_bytes);
            let time_elapsed = now.duration_since(*last_time);

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
                    j.update_progress(bytes_processed, "Decrypting");
                });

                emitter_for_progress.emit_job_progress(&DecryptionJobProgressPayload {
                    operation_id: op_id_for_progress.clone(),
                    job_id: job_id_for_progress.clone(),
                    input_path: input_path_for_progress.clone(),
                    bytes_processed,
                    total_bytes: total,
                    percentage,
                    stage: "Decrypting".to_string(),
                    status: BatchJobStatus::Encrypting,
                    output_path: None,
                    error: None,
                });

                Self::emit_aggregated_progress(&op_id_for_progress, &registry_for_progress, &emitter_for_progress);
            }
        });

        // Setup cancellation closure
        let op_id_for_cancel = operation_id.to_string();
        let job_id_for_cancel = job_id.clone();
        let cancellation_for_stream = Arc::clone(cancellation);
        let is_cancelled_cb = Box::new(move || {
            cancellation_for_stream.is_cancelled(&op_id_for_cancel, Some(&job_id_for_cancel))
        });

        // 8. Stream decryption
        let stream_res = decrypt_file_stream(
            input_path,
            &temp_path,
            &derived_key,
            &header,
            original_meta.file_size,
            Some(progress_cb),
            Some(is_cancelled_cb),
        );

        match stream_res {
            Ok((_bytes_read, decrypted_size)) => {
                let _ = job.status.transition_to(BatchJobStatus::Finalizing);
                job.stage = "Finalizing".to_string();
                registry.update_job(operation_id, &job_id, |j| {
                    let _ = j.status.transition_to(BatchJobStatus::Finalizing);
                    j.stage = "Finalizing".to_string();
                });

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

                let duration_ms = job_start.elapsed().as_millis() as u64;
                let _ = job.status.transition_to(BatchJobStatus::Completed);
                job.stage = "Completed".to_string();
                job.processed_bytes = decrypted_size;
                job.progress_percentage = 100.0;
                job.duration_ms = Some(duration_ms);
                job.completed_at = Some(Utc::now().to_rfc3339());

                registry.update_job(operation_id, &job_id, |j| {
                    let _ = j.status.transition_to(BatchJobStatus::Completed);
                    j.stage = "Completed".to_string();
                    j.processed_bytes = decrypted_size;
                    j.progress_percentage = 100.0;
                    j.duration_ms = Some(duration_ms);
                    j.completed_at = Some(Utc::now().to_rfc3339());
                });

                emitter.emit_job_progress(&DecryptionJobProgressPayload {
                    operation_id: operation_id.to_string(),
                    job_id: job_id.clone(),
                    input_path: input_path_str,
                    bytes_processed: total_bytes,
                    total_bytes,
                    percentage: 100.0,
                    stage: "Completed".to_string(),
                    status: BatchJobStatus::Completed,
                    output_path: Some(output_path_str),
                    error: None,
                });

                Self::emit_aggregated_progress(operation_id, registry, emitter);
            }
            Err(AppError::Cancelled(_)) => {
                warn!("Job {} was cancelled during decryption streaming", job_id);
                let _ = cleanup_temp_file_path(&temp_path);

                let _ = job.status.transition_to(BatchJobStatus::Cancelled);
                job.stage = "Cancelled".to_string();
                registry.update_job(operation_id, &job_id, |j| {
                    let _ = j.status.transition_to(BatchJobStatus::Cancelled);
                    j.stage = "Cancelled".to_string();
                });

                emitter.emit_job_progress(&DecryptionJobProgressPayload {
                    operation_id: operation_id.to_string(),
                    job_id: job_id.clone(),
                    input_path: input_path_str,
                    bytes_processed: 0,
                    total_bytes,
                    percentage: 0.0,
                    stage: "Cancelled".to_string(),
                    status: BatchJobStatus::Cancelled,
                    output_path: None,
                    error: None,
                });

                Self::emit_aggregated_progress(operation_id, registry, emitter);
            }
            Err(e) => {
                error!("Job {} failed during decryption: {:?}", job_id, e);
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
        emitter: &Arc<dyn DecryptionEventEmitter>,
    ) {
        registry.update_job(operation_id, job_id, |j| {
            let _ = j.status.transition_to(BatchJobStatus::Failed);
            j.stage = "Failed".to_string();
            j.error = Some(error_msg.to_string());
            j.completed_at = Some(Utc::now().to_rfc3339());
        });

        emitter.emit_job_progress(&DecryptionJobProgressPayload {
            operation_id: operation_id.to_string(),
            job_id: job_id.to_string(),
            input_path: input_path.to_string(),
            bytes_processed: 0,
            total_bytes,
            percentage: 0.0,
            stage: "Failed".to_string(),
            status: BatchJobStatus::Failed,
            output_path: None,
            error: Some(error_msg.to_string()),
        });

        Self::emit_aggregated_progress(operation_id, registry, emitter);
    }

    fn emit_aggregated_progress(
        operation_id: &str,
        registry: &Arc<OperationRegistry>,
        emitter: &Arc<dyn DecryptionEventEmitter>,
    ) {
        if let Some(op) = registry.get_operation(operation_id) {
            emitter.emit_batch_progress(&DecryptionProgressPayload {
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
