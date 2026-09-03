use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::AppError;

/// Lifecycle state for an overall batch encryption operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationStatus {
    Created,
    Queued,
    Running,
    Cancelling,
    Completed,
    CompletedWithErrors,
    Cancelled,
    Failed,
}

impl OperationStatus {
    /// Returns true if this status represents an immutable terminal state.
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            OperationStatus::Completed
                | OperationStatus::CompletedWithErrors
                | OperationStatus::Cancelled
                | OperationStatus::Failed
        )
    }

    /// Validates whether a state transition from `self` to `target` is allowed.
    pub fn can_transition_to(&self, target: OperationStatus) -> bool {
        if self == &target {
            return true;
        }

        // Terminal states cannot transition to anything else
        if self.is_terminal() {
            return false;
        }

        match self {
            OperationStatus::Created => matches!(
                target,
                OperationStatus::Queued
                    | OperationStatus::Running
                    | OperationStatus::Cancelling
                    | OperationStatus::Cancelled
                    | OperationStatus::Failed
            ),
            OperationStatus::Queued => matches!(
                target,
                OperationStatus::Running
                    | OperationStatus::Cancelling
                    | OperationStatus::Cancelled
                    | OperationStatus::Failed
            ),
            OperationStatus::Running => matches!(
                target,
                OperationStatus::Cancelling
                    | OperationStatus::Completed
                    | OperationStatus::CompletedWithErrors
                    | OperationStatus::Cancelled
                    | OperationStatus::Failed
            ),
            OperationStatus::Cancelling => matches!(
                target,
                OperationStatus::Cancelled | OperationStatus::CompletedWithErrors | OperationStatus::Failed
            ),
            _ => false,
        }
    }

    /// Performs the state transition or returns an InvalidOperationState error.
    pub fn transition_to(&mut self, target: OperationStatus) -> Result<(), AppError> {
        if !self.can_transition_to(target) {
            return Err(AppError::InvalidOperationState(format!(
                "Invalid operation state transition from {:?} to {:?}",
                self, target
            )));
        }
        *self = target;
        Ok(())
    }
}

/// Lifecycle state for an individual file encryption/decryption job within a batch.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Preparing,
    Encrypting,
    Decrypting,
    Finalizing,
    Completed,
    Skipped,
    Failed,
    Cancelling,
    Cancelled,
}

impl JobStatus {
    /// Returns true if this status represents an immutable terminal state.
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            JobStatus::Completed | JobStatus::Skipped | JobStatus::Failed | JobStatus::Cancelled
        )
    }

    /// Validates whether a state transition from `self` to `target` is allowed.
    pub fn can_transition_to(&self, target: JobStatus) -> bool {
        if self == &target {
            return true;
        }

        // Terminal states cannot transition to anything else
        if self.is_terminal() {
            return false;
        }

        match self {
            JobStatus::Queued => matches!(
                target,
                JobStatus::Preparing
                    | JobStatus::Skipped
                    | JobStatus::Cancelling
                    | JobStatus::Cancelled
                    | JobStatus::Failed
            ),
            JobStatus::Preparing => matches!(
                target,
                JobStatus::Encrypting
                    | JobStatus::Decrypting
                    | JobStatus::Skipped
                    | JobStatus::Cancelling
                    | JobStatus::Cancelled
                    | JobStatus::Failed
            ),
            JobStatus::Encrypting | JobStatus::Decrypting => matches!(
                target,
                JobStatus::Finalizing
                    | JobStatus::Cancelling
                    | JobStatus::Cancelled
                    | JobStatus::Failed
            ),
            JobStatus::Finalizing => matches!(
                target,
                JobStatus::Completed | JobStatus::Failed
            ),
            JobStatus::Cancelling => matches!(
                target,
                JobStatus::Cancelled | JobStatus::Failed
            ),
            _ => false,
        }
    }

    /// Performs the state transition or returns an InvalidJobState error.
    pub fn transition_to(&mut self, target: JobStatus) -> Result<(), AppError> {
        if !self.can_transition_to(target) {
            return Err(AppError::InvalidJobState(format!(
                "Invalid job state transition from {:?} to {:?}",
                self, target
            )));
        }
        *self = target;
        Ok(())
    }
}

/// Strongly typed request payload to start an encryption batch.
#[derive(Deserialize)]
pub struct StartEncryptionBatchRequest {
    pub input_files: Vec<String>,
    pub output_directory: Option<String>,
    pub password: String,
    pub concurrency: Option<usize>,
    pub overwrite: Option<bool>,
}

// Ensure password is never printed in debug logs.
impl std::fmt::Debug for StartEncryptionBatchRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StartEncryptionBatchRequest")
            .field("input_files", &self.input_files)
            .field("output_directory", &self.output_directory)
            .field("concurrency", &self.concurrency)
            .field("overwrite", &self.overwrite)
            .field("password", &"[REDACTED]")
            .finish()
    }
}

/// Independent encryption job for a single file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionJob {
    pub job_id: String,
    pub operation_id: String,
    pub input_path: String,
    pub output_path: Option<String>,
    pub output_name: Option<String>,
    pub status: JobStatus,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub progress_percentage: f64,
    pub stage: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

impl EncryptionJob {
    pub fn new(operation_id: String, input_path: String, total_bytes: u64) -> Self {
        let job_id = format!("job-{}", Uuid::new_v4());
        Self {
            job_id,
            operation_id,
            input_path,
            output_path: None,
            output_name: None,
            status: JobStatus::Queued,
            total_bytes,
            processed_bytes: 0,
            progress_percentage: 0.0,
            stage: "Queued".to_string(),
            error: None,
            duration_ms: None,
            created_at: Utc::now().to_rfc3339(),
            completed_at: None,
        }
    }

    pub fn update_progress(&mut self, bytes_processed: u64, stage: &str) {
        self.processed_bytes = bytes_processed;
        self.progress_percentage = if self.total_bytes > 0 {
            ((bytes_processed as f64 / self.total_bytes as f64) * 100.0).clamp(0.0, 100.0)
        } else {
            100.0
        };
        self.stage = stage.to_string();
    }
}

/// Operation representing an overall batch of encryption jobs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionOperation {
    pub operation_id: String,
    pub status: OperationStatus,
    pub total_files: usize,
    pub completed_files: usize,
    pub failed_files: usize,
    pub cancelled_files: usize,
    pub skipped_files: usize,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    pub jobs: Vec<EncryptionJob>,
}

impl EncryptionOperation {
    pub fn new(jobs: Vec<EncryptionJob>) -> Self {
        let operation_id = format!("op-{}", Uuid::new_v4());
        let total_files = jobs.len();
        let total_bytes = jobs.iter().map(|j| j.total_bytes).sum();

        Self {
            operation_id,
            status: OperationStatus::Created,
            total_files,
            completed_files: 0,
            failed_files: 0,
            cancelled_files: 0,
            skipped_files: 0,
            total_bytes,
            processed_bytes: 0,
            created_at: Utc::now().to_rfc3339(),
            started_at: None,
            completed_at: None,
            jobs,
        }
    }

    /// Recalculates overall processed bytes, completed counts, and status from jobs.
    pub fn recalculate_totals(&mut self) {
        let mut completed = 0;
        let mut failed = 0;
        let mut cancelled = 0;
        let mut skipped = 0;
        let mut processed = 0;

        for job in &self.jobs {
            processed += job.processed_bytes;
            match job.status {
                JobStatus::Completed => completed += 1,
                JobStatus::Failed => failed += 1,
                JobStatus::Cancelled => cancelled += 1,
                JobStatus::Skipped => skipped += 1,
                _ => {}
            }
        }

        self.completed_files = completed;
        self.failed_files = failed;
        self.cancelled_files = cancelled;
        self.skipped_files = skipped;
        self.processed_bytes = processed;

        let all_terminal = self.jobs.iter().all(|j| j.status.is_terminal());
        if all_terminal && !self.status.is_terminal() {
            self.completed_at = Some(Utc::now().to_rfc3339());
            if self.failed_files > 0 || self.cancelled_files > 0 {
                if self.completed_files > 0 {
                    let _ = self.status.transition_to(OperationStatus::CompletedWithErrors);
                } else if self.cancelled_files > 0 && self.failed_files == 0 {
                    let _ = self.status.transition_to(OperationStatus::Cancelled);
                } else {
                    let _ = self.status.transition_to(OperationStatus::Failed);
                }
            } else {
                let _ = self.status.transition_to(OperationStatus::Completed);
            }
        }
    }

    /// Overall progress percentage (byte-weighted).
    pub fn progress_percentage(&self) -> f64 {
        if self.total_bytes > 0 {
            ((self.processed_bytes as f64 / self.total_bytes as f64) * 100.0).clamp(0.0, 100.0)
        } else if self.total_files > 0 {
            (((self.completed_files + self.skipped_files) as f64 / self.total_files as f64) * 100.0).clamp(0.0, 100.0)
        } else {
            100.0
        }
    }
}

/// Type of operation performed
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationType {
    Encrypt,
    Decrypt,
}

/// Serializable progress event for the entire batch operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProgressEvent {
    pub operation_id: String,
    pub total_files: usize,
    pub completed_files: usize,
    pub failed_files: usize,
    pub cancelled_files: usize,
    pub skipped_files: usize,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub percentage: f64,
    pub status: OperationStatus,
}

/// Serializable progress and status event for an individual job.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgressEvent {
    pub operation_id: String,
    pub job_id: String,
    pub input_path: String,
    pub bytes_processed: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub stage: String,
    pub status: JobStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Public individual job summary result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResult {
    pub job_id: String,
    pub input_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_name: Option<String>,
    pub status: JobStatus,
    pub original_size: u64,
    pub encrypted_size: u64,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Comprehensive result of an entire completed/finalized batch operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionOperationResult {
    pub operation_id: String,
    pub status: OperationStatus,
    pub total_files: usize,
    pub successful_files: usize,
    pub failed_files: usize,
    pub cancelled_files: usize,
    pub skipped_files: usize,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub duration_ms: u64,
    pub started_at: String,
    pub completed_at: String,
    pub jobs: Vec<JobResult>,
}

/// In-memory non-persistent Job Summary for Current Session view
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobSummary {
    pub job_id: String,
    pub input_path: String,
    pub input_filename: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_filename: Option<String>,
    pub status: JobStatus,
    pub duration_ms: u64,
    pub bytes_processed: u64,
    pub total_bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub safe_error: Option<String>,
    pub is_skipped: bool,
}

/// In-memory non-persistent Operation Summary for Current Session tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationSummary {
    pub operation_id: String,
    pub operation_type: OperationType,
    pub status: OperationStatus,
    pub started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    pub duration_ms: u64,
    pub total_files: usize,
    pub completed_files: usize,
    pub failed_files: usize,
    pub cancelled_files: usize,
    pub skipped_files: usize,
    pub total_bytes: u64,
    pub processed_bytes: u64,
    pub jobs: Vec<JobSummary>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_operation_status_transitions() {
        let mut status = OperationStatus::Created;
        assert!(status.can_transition_to(OperationStatus::Queued));
        assert!(status.transition_to(OperationStatus::Queued).is_ok());

        assert!(status.can_transition_to(OperationStatus::Running));
        assert!(status.transition_to(OperationStatus::Running).is_ok());

        assert!(status.can_transition_to(OperationStatus::Completed));
        assert!(status.transition_to(OperationStatus::Completed).is_ok());

        // Terminal state cannot transition back
        assert!(!status.can_transition_to(OperationStatus::Running));
        assert!(status.transition_to(OperationStatus::Running).is_err());
    }

    #[test]
    fn test_job_status_transitions() {
        let mut status = JobStatus::Queued;
        assert!(status.transition_to(JobStatus::Preparing).is_ok());
        assert!(status.transition_to(JobStatus::Encrypting).is_ok());
        assert!(status.transition_to(JobStatus::Finalizing).is_ok());
        assert!(status.transition_to(JobStatus::Completed).is_ok());

        // Terminal state cannot transition back
        assert!(status.transition_to(JobStatus::Encrypting).is_err());
    }

    #[test]
    fn test_job_cancellation_transitions() {
        let mut status = JobStatus::Encrypting;
        assert!(status.transition_to(JobStatus::Cancelling).is_ok());
        assert!(status.transition_to(JobStatus::Cancelled).is_ok());
        assert!(status.is_terminal());
    }

    #[test]
    fn test_unique_operation_and_job_ids() {
        let job1 = EncryptionJob::new("op-1".to_string(), "/test/1.txt".to_string(), 100);
        let job2 = EncryptionJob::new("op-1".to_string(), "/test/2.txt".to_string(), 200);
        assert_ne!(job1.job_id, job2.job_id);

        let op1 = EncryptionOperation::new(vec![job1]);
        let op2 = EncryptionOperation::new(vec![job2]);
        assert_ne!(op1.operation_id, op2.operation_id);
    }
}
