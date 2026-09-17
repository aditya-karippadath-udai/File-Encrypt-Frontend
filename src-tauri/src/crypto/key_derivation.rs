use crate::errors::AppError;
use argon2::{Algorithm, Argon2, Params, Version};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Standard output key size for AEAD encryption (256-bit / 32-byte key).
pub const STANDARD_KEY_LENGTH: usize = 32;

/// Default Argon2id parameters optimized for interactive desktop local file encryption.
/// - Memory cost: 64 MB (65,536 KiB)
/// - Time cost: 3 iterations
/// - Parallelism: 4 threads
/// - Key Length: 32 bytes (256-bit)
pub const DEFAULT_M_COST: u32 = 65536;
pub const DEFAULT_T_COST: u32 = 3;
pub const DEFAULT_P_COST: u32 = 4;

/// Strongly typed cryptographic configuration for Argon2id key derivation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Argon2ParamsConfig {
    pub memory_cost_kib: u32,
    pub time_cost_iterations: u32,
    pub parallelism_threads: u32,
    pub output_length_bytes: usize,
    pub algorithm: String,
}

impl Default for Argon2ParamsConfig {
    fn default() -> Self {
        Self {
            memory_cost_kib: DEFAULT_M_COST,
            time_cost_iterations: DEFAULT_T_COST,
            parallelism_threads: DEFAULT_P_COST,
            output_length_bytes: STANDARD_KEY_LENGTH,
            algorithm: "Argon2id".to_string(),
        }
    }
}

impl Argon2ParamsConfig {
    /// Validates parameters against security and platform constraints.
    pub fn validate(&self) -> Result<(), AppError> {
        if self.algorithm != "Argon2id" {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Unsupported KDF algorithm: {}. Only Argon2id is allowed.",
                self.algorithm
            )));
        }

        // Memory cost: minimum 8 MB (8192 KiB), maximum 1 GB (1048576 KiB)
        if self.memory_cost_kib < 8192 || self.memory_cost_kib > 1048576 {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Memory cost {} KiB is outside secure bounds [8192, 1048576]",
                self.memory_cost_kib
            )));
        }

        // Time cost: minimum 1 iteration, maximum 32 iterations
        if self.time_cost_iterations < 1 || self.time_cost_iterations > 32 {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Time cost {} is outside secure bounds [1, 32]",
                self.time_cost_iterations
            )));
        }

        // Parallelism: minimum 1 thread, maximum 16 threads
        if self.parallelism_threads < 1 || self.parallelism_threads > 16 {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Parallelism {} is outside secure bounds [1, 16]",
                self.parallelism_threads
            )));
        }

        // Output length: minimum 16 bytes, maximum 64 bytes (standard is 32)
        if self.output_length_bytes < 16 || self.output_length_bytes > 64 {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Output key length {} is outside allowable range [16, 64]",
                self.output_length_bytes
            )));
        }

        Ok(())
    }

    /// Creates and validates a new Argon2id parameter configuration with standard key length.
    pub fn new(
        memory_cost_kib: u32,
        time_cost_iterations: u32,
        parallelism_threads: u32,
    ) -> Result<Self, AppError> {
        let config = Self {
            memory_cost_kib,
            time_cost_iterations,
            parallelism_threads,
            output_length_bytes: STANDARD_KEY_LENGTH,
            algorithm: "Argon2id".to_string(),
        };
        config.validate()?;
        Ok(config)
    }
}

/// Secure container for sensitive derived encryption key bytes.
/// Automatically zeroizes memory on drop and prevents accidental serialization or string formatting.
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct DerivedKey {
    key: Vec<u8>,
    #[zeroize(skip)]
    algorithm: String,
}

impl DerivedKey {
    /// Constructor for derived key material.
    pub fn new(key: impl Into<Vec<u8>>) -> Self {
        Self {
            key: key.into(),
            algorithm: "Argon2id".to_string(),
        }
    }

    /// Constructor with specific algorithm label.
    pub fn with_algorithm(key: impl Into<Vec<u8>>, algorithm: String) -> Self {
        Self {
            key: key.into(),
            algorithm,
        }
    }

    /// Length of the derived key in bytes.
    pub fn len(&self) -> usize {
        self.key.len()
    }

    /// True if key buffer is empty.
    pub fn is_empty(&self) -> bool {
        self.key.is_empty()
    }

    /// The cryptographic algorithm used to derive this key (e.g. "Argon2id").
    pub fn algorithm(&self) -> &str {
        &self.algorithm
    }

    /// Controlled access to raw key bytes for future cryptographic encryption engines.
    pub fn expose_secret(&self) -> &[u8] {
        &self.key
    }

    /// Controlled access to raw key bytes for internal cryptographic engines.
    pub fn as_bytes(&self) -> &[u8] {
        &self.key
    }
}

// Custom Debug implementation that protects raw key bytes from being logged or dumped
impl std::fmt::Debug for DerivedKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DerivedKey")
            .field("algorithm", &self.algorithm)
            .field("key_length_bytes", &self.key.len())
            .finish()
    }
}

/// Derives a cryptographic encryption key from a password and salt using Argon2id.
pub fn derive_key_argon2id(
    password: &str,
    salt: &[u8],
    config: Option<&Argon2ParamsConfig>,
) -> Result<DerivedKey, AppError> {
    if password.is_empty() {
        return Err(AppError::PasswordRequired(
            "Password cannot be empty for key derivation.".to_string(),
        ));
    }

    let default_config = Argon2ParamsConfig::default();
    let effective_config = config.unwrap_or(&default_config);
    effective_config.validate()?;

    let params = Params::new(
        effective_config.memory_cost_kib,
        effective_config.time_cost_iterations,
        effective_config.parallelism_threads,
        Some(effective_config.output_length_bytes),
    )
    .map_err(|e| {
        AppError::InvalidCryptoConfiguration(format!("Argon2 params configuration error: {}", e))
    })?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key_buf = vec![0u8; effective_config.output_length_bytes];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key_buf)
        .map_err(|e| {
            AppError::KeyDerivationFailed(format!("Argon2id execution failed: {}", e))
        })?;

    Ok(DerivedKey::with_algorithm(
        key_buf,
        effective_config.algorithm.clone(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::random::Salt;

    #[test]
    fn test_argon2id_derivation_deterministic() {
        let password = "correct horse battery staple";
        let salt = Salt::generate().expect("Failed salt");

        // Use light params for unit testing speed
        let config = Argon2ParamsConfig {
            memory_cost_kib: 8192,
            time_cost_iterations: 1,
            parallelism_threads: 1,
            output_length_bytes: 32,
            algorithm: "Argon2id".to_string(),
        };

        let key1 = derive_key_argon2id(password, salt.as_bytes(), Some(&config))
            .expect("Derivation 1 failed");
        let key2 = derive_key_argon2id(password, salt.as_bytes(), Some(&config))
            .expect("Derivation 2 failed");

        assert_eq!(key1.len(), 32);
        assert_eq!(key2.len(), 32);
        assert_eq!(key1.expose_secret(), key2.expose_secret());
    }

    #[test]
    fn test_argon2id_different_salts_yield_different_keys() {
        let password = "my-secure-password";
        let salt1 = Salt::generate().expect("Salt 1 failed");
        let salt2 = Salt::generate().expect("Salt 2 failed");

        let config = Argon2ParamsConfig {
            memory_cost_kib: 8192,
            time_cost_iterations: 1,
            parallelism_threads: 1,
            output_length_bytes: 32,
            algorithm: "Argon2id".to_string(),
        };

        let key1 = derive_key_argon2id(password, salt1.as_bytes(), Some(&config)).unwrap();
        let key2 = derive_key_argon2id(password, salt2.as_bytes(), Some(&config)).unwrap();

        assert_ne!(key1.expose_secret(), key2.expose_secret());
    }

    #[test]
    fn test_argon2id_different_passwords_yield_different_keys() {
        let salt = Salt::generate().expect("Salt failed");

        let config = Argon2ParamsConfig {
            memory_cost_kib: 8192,
            time_cost_iterations: 1,
            parallelism_threads: 1,
            output_length_bytes: 32,
            algorithm: "Argon2id".to_string(),
        };

        let key1 = derive_key_argon2id("password-A", salt.as_bytes(), Some(&config)).unwrap();
        let key2 = derive_key_argon2id("password-B", salt.as_bytes(), Some(&config)).unwrap();

        assert_ne!(key1.expose_secret(), key2.expose_secret());
    }

    #[test]
    fn test_argon2id_empty_password_rejected() {
        let salt = Salt::generate().unwrap();
        let result = derive_key_argon2id("", salt.as_bytes(), None);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_config_rejected() {
        let salt = Salt::generate().unwrap();
        let bad_config = Argon2ParamsConfig {
            memory_cost_kib: 128, // Below minimum 8192
            time_cost_iterations: 1,
            parallelism_threads: 1,
            output_length_bytes: 32,
            algorithm: "Argon2id".to_string(),
        };

        let result = derive_key_argon2id("test", salt.as_bytes(), Some(&bad_config));
        assert!(result.is_err());
    }
}
