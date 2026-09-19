use serde::{Deserialize, Serialize};

use crate::models::operation::{JobResult, JobStatus, OperationStatus};

/// Single-file decryption request payload.
/// Note: The password exists only in native memory for the duration of decryption and key derivation.
#[derive(Debug, Clone, Deserialize)]
pub struct DecryptionRequest {
    pub input_path: String,
    #[serde(default)]
    pub output_path: Option<String>,
    #[serde(default)]
    pub output_dir: Option<String>,
    pub password: String,
    #[serde(default)]
    pub overwrite: Option<bool>,
}

/// Single-file decryption result payload.
/// Note: Zero passwords, keys, or sensitive salts are ever returned to the caller.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptionResult {
    pub input_path: String,
    pub output_path: String,
    pub output_name: String,
    pub original_size: u64,
    pub decrypted_size: u64,
    pub algorithm: String,
    pub key_derivation: String,
    pub duration_ms: u64,
    pub status: String,
}

/// Request to start a batch decryption operation across multiple files.
#[derive(Debug, Clone, Deserialize)]
pub struct StartDecryptionBatchRequest {
    pub input_files: Vec<String>,
    #[serde(default)]
    pub output_directory: Option<String>,
    pub password: String,
    #[serde(default)]
    pub concurrency: Option<usize>,
    #[serde(default)]
    pub overwrite: Option<bool>,
}

/// Progress event emitted per-job during decryption.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptionJobProgressPayload {
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

/// Progress event emitted for the aggregate batch decryption operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptionProgressPayload {
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

/// Final summary returned upon completion of a batch decryption operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptionOperationResult {
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
