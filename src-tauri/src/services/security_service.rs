use crate::crypto::{derive_key_argon2id, Argon2ParamsConfig, Salt};
use crate::errors::AppError;
use crate::models::{
    KeyDerivationRequest, KeyDerivationResponse, PasswordValidationRequest, PasswordValidationResult,
};
use log::{error, info};

pub const MAX_PASSWORD_LENGTH: usize = 1024;
pub const RECOMMENDED_MIN_PASSWORD_LENGTH: usize = 8;

/// Service handling password verification, secure salt generation, and Argon2id key derivation.
#[derive(Default)]
pub struct SecurityService {
    kdf_config: Argon2ParamsConfig,
}

impl SecurityService {
    pub fn new() -> Self {
        Self {
            kdf_config: Argon2ParamsConfig::default(),
        }
    }

    /// Validates password constraints and confirmation match without logging password contents.
    pub fn validate_password(
        &self,
        request: &PasswordValidationRequest,
    ) -> Result<PasswordValidationResult, AppError> {
        let password = &request.password;
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        if password.is_empty() {
            errors.push("Password cannot be empty.".to_string());
        }

        if password.len() > MAX_PASSWORD_LENGTH {
            errors.push(format!(
                "Password exceeds maximum allowable length of {} characters.",
                MAX_PASSWORD_LENGTH
            ));
        }

        if let Some(ref confirm) = request.confirm_password {
            if password != confirm {
                errors.push("Passwords do not match.".to_string());
            }
        }

        if !password.is_empty() && password.len() < RECOMMENDED_MIN_PASSWORD_LENGTH {
            warnings.push(format!(
                "Password is short. We recommend at least {} characters for optimal security.",
                RECOMMENDED_MIN_PASSWORD_LENGTH
            ));
        }

        let is_valid = errors.is_empty();
        Ok(PasswordValidationResult {
            is_valid,
            errors,
            warnings,
        })
    }

    /// Performs test/preparation Argon2id key derivation with a freshly generated secure salt.
    /// Derives the 256-bit key in-memory and drops it with zeroization.
    /// Returns only safe metadata.
    pub fn prepare_key_derivation(
        &self,
        request: &KeyDerivationRequest,
    ) -> Result<KeyDerivationResponse, AppError> {
        let password = &request.password;
        if password.is_empty() {
            return Err(AppError::PasswordRequired(
                "Password cannot be empty for key derivation.".to_string(),
            ));
        }

        if password.len() > MAX_PASSWORD_LENGTH {
            return Err(AppError::PasswordTooLong(format!(
                "Password length exceeds maximum allowed limit of {} characters.",
                MAX_PASSWORD_LENGTH
            )));
        }

        info!("Starting Argon2id key derivation test with secure random salt");
        let salt = Salt::generate().map_err(|e| {
            error!("Failed to generate secure salt: {:?}", e);
            e
        })?;

        // Derive key using application-controlled parameters
        let derived_key = derive_key_argon2id(password, salt.as_bytes(), Some(&self.kdf_config))
            .map_err(|e| {
                error!("Key derivation failed: {:?}", e);
                e
            })?;

        let key_len = derived_key.len();
        let algo = derived_key.algorithm().to_string();

        // `derived_key` goes out of scope here and its memory is safely zeroized
        drop(derived_key);

        info!("Argon2id key derivation succeeded ({} bytes generated)", key_len);

        Ok(KeyDerivationResponse {
            success: true,
            algorithm: algo,
            key_length: key_len,
            memory_cost_kib: self.kdf_config.memory_cost_kib,
            time_cost_iterations: self.kdf_config.time_cost_iterations,
            parallelism_threads: self.kdf_config.parallelism_threads,
        })
    }

    /// Returns standard application KDF parameters info
    pub fn get_default_config(&self) -> &Argon2ParamsConfig {
        &self.kdf_config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_password_success() {
        let service = SecurityService::new();
        let req = PasswordValidationRequest {
            password: "correct-horse-battery-staple".to_string(),
            confirm_password: Some("correct-horse-battery-staple".to_string()),
        };

        let result = service.validate_password(&req).unwrap();
        assert!(result.is_valid);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_validate_password_mismatch() {
        let service = SecurityService::new();
        let req = PasswordValidationRequest {
            password: "password123".to_string(),
            confirm_password: Some("password456".to_string()),
        };

        let result = service.validate_password(&req).unwrap();
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| e.contains("do not match")));
    }

    #[test]
    fn test_validate_password_empty() {
        let service = SecurityService::new();
        let req = PasswordValidationRequest {
            password: "".to_string(),
            confirm_password: None,
        };

        let result = service.validate_password(&req).unwrap();
        assert!(!result.is_valid);
        assert!(result.errors.iter().any(|e| e.contains("cannot be empty")));
    }

    #[test]
    fn test_prepare_key_derivation_flow() {
        let service = SecurityService::new();
        let req = KeyDerivationRequest {
            password: "test-encryption-passphrase".to_string(),
        };

        let res = service.prepare_key_derivation(&req).unwrap();
        assert!(res.success);
        assert_eq!(res.algorithm, "Argon2id");
        assert_eq!(res.key_length, 32);
    }
}
