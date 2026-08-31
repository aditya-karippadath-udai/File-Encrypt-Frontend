use serde::{Deserialize, Serialize};

/// Request to encrypt a single file.
#[derive(Deserialize)]
pub struct EncryptionRequest {
    pub input_path: String,
    pub output_path: Option<String>,
    pub output_dir: Option<String>,
    pub password: String,
    pub overwrite: Option<bool>,
}

// Custom Debug implementation to ensure the password is NEVER logged.
impl std::fmt::Debug for EncryptionRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("EncryptionRequest")
            .field("input_path", &self.input_path)
            .field("output_path", &self.output_path)
            .field("output_dir", &self.output_dir)
            .field("overwrite", &self.overwrite)
            .field("password", &"[REDACTED]")
            .finish()
    }
}

/// Safe public result of a successful encryption operation returned to the frontend.
/// CRITICAL: Contains zero passwords, keys, salts, or sensitive cryptographic state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionResult {
    pub input_path: String,
    pub output_path: String,
    pub output_name: String,
    pub original_size: u64,
    pub encrypted_size: u64,
    pub algorithm: String,
    pub key_derivation: String,
    pub duration_ms: u64,
    pub status: String,
}

/// Progress event emitted or tracked during streaming encryption.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionProgressEvent {
    pub input_path: String,
    pub bytes_processed: u64,
    pub total_bytes: u64,
    pub percent: f64,
    pub stage: String,
}
