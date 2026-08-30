use serde::{Deserialize, Serialize};

/// Request payload for backend password validation.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordValidationRequest {
    pub password: String,
    pub confirm_password: Option<String>,
}

/// Structured response for password validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Request payload for preparing/testing key derivation.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyDerivationRequest {
    pub password: String,
}

/// Safe public metadata response for key derivation operations.
/// CRITICAL: NEVER contains raw derived key bytes, passwords, or raw secrets.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyDerivationResponse {
    pub success: bool,
    pub algorithm: String,
    pub key_length: usize,
    pub memory_cost_kib: u32,
    pub time_cost_iterations: u32,
    pub parallelism_threads: u32,
}
