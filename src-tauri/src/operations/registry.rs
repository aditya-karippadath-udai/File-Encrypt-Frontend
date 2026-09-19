use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::models::{
    EncryptionJob, EncryptionOperation, JobStatus, JobSummary, OperationSummary, OperationType,
};

/// Thread-safe in-memory registry for tracking active operations and historical summaries in current session.
#[derive(Clone, Default)]
pub struct OperationRegistry {
    operations: Arc<RwLock<HashMap<String, (EncryptionOperation, OperationType)>>>,
    session_summaries: Arc<RwLock<Vec<OperationSummary>>>,
}

impl OperationRegistry {
    pub fn new() -> Self {
        Self {
            operations: Arc::new(RwLock::new(HashMap::new())),
            session_summaries: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Stores a new active operation.
    pub fn insert_operation(&self, op: EncryptionOperation, op_type: OperationType) {
        if let Ok(mut map) = self.operations.write() {
            map.insert(op.operation_id.clone(), (op, op_type));
        }
    }

    /// Retrieves a cloned snapshot of an active operation.
    pub fn get_operation(&self, operation_id: &str) -> Option<EncryptionOperation> {
        let map = self.operations.read().ok()?;
        map.get(operation_id).map(|(op, _)| op.clone())
    }

    /// Safely updates an individual job within an operation and recalculates totals.
    pub fn update_job<F>(&self, operation_id: &str, job_id: &str, update_fn: F) -> Option<EncryptionJob>
    where
        F: FnOnce(&mut EncryptionJob),
    {
        let mut map = self.operations.write().ok()?;
        let (op, _) = map.get_mut(operation_id)?;

        let mut updated_job = None;
        for job in &mut op.jobs {
            if job.job_id == job_id {
                update_fn(job);
                updated_job = Some(job.clone());
                break;
            }
        }

        if updated_job.is_some() {
            op.recalculate_totals();
        }

        updated_job
    }

    /// Recalculates totals and terminal status for an operation and returns the updated snapshot.
    pub fn recalculate_operation(&self, operation_id: &str) -> Option<EncryptionOperation> {
        let mut map = self.operations.write().ok()?;
        let (op, _) = map.get_mut(operation_id)?;
        op.recalculate_totals();
        Some(op.clone())
    }

    /// Finalizes and records an operation into the in-memory current session summaries.
    pub fn record_session_summary(
        &self,
        operation: &EncryptionOperation,
        op_type: OperationType,
        duration_ms: u64,
    ) {
        let jobs: Vec<JobSummary> = operation
            .jobs
            .iter()
            .map(|j| {
                let input_filename = std::path::Path::new(&j.input_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("file")
                    .to_string();

                JobSummary {
                    job_id: j.job_id.clone(),
                    input_path: j.input_path.clone(),
                    input_filename,
                    output_path: j.output_path.clone(),
                    output_filename: j.output_name.clone(),
                    status: j.status,
                    duration_ms: j.duration_ms.unwrap_or(0),
                    bytes_processed: j.processed_bytes,
                    total_bytes: j.total_bytes,
                    safe_error: j.error.clone(),
                    is_skipped: j.status == JobStatus::Skipped,
                }
            })
            .collect();

        let summary = OperationSummary {
            operation_id: operation.operation_id.clone(),
            operation_type: op_type,
            status: operation.status,
            started_at: operation
                .started_at
                .clone()
                .unwrap_or_else(|| operation.created_at.clone()),
            completed_at: operation.completed_at.clone(),
            duration_ms,
            total_files: operation.total_files,
            completed_files: operation.completed_files,
            failed_files: operation.failed_files,
            cancelled_files: operation.cancelled_files,
            skipped_files: operation.skipped_files,
            total_bytes: operation.total_bytes,
            processed_bytes: operation.processed_bytes,
            jobs,
        };

        if let Ok(mut summaries) = self.session_summaries.write() {
            // Prepend new summary so newest comes first
            summaries.insert(0, summary);
        }
    }

    /// Gets all non-persistent session operation summaries.
    pub fn get_session_summaries(&self) -> Vec<OperationSummary> {
        if let Ok(summaries) = self.session_summaries.read() {
            summaries.clone()
        } else {
            Vec::new()
        }
    }

    /// Gets a specific session operation summary by ID.
    pub fn get_session_summary(&self, operation_id: &str) -> Option<OperationSummary> {
        let summaries = self.session_summaries.read().ok()?;
        summaries.iter().find(|s| s.operation_id == operation_id).cloned()
    }

    /// Clears in-memory session summaries.
    pub fn clear_session_summaries(&self) {
        if let Ok(mut summaries) = self.session_summaries.write() {
            summaries.clear();
        }
    }

    /// Removes an operation from the active registry.
    pub fn remove_operation(&self, operation_id: &str) {
        if let Ok(mut map) = self.operations.write() {
            map.remove(operation_id);
        }
    }
}
