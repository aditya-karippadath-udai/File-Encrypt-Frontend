use crate::errors::AppError;
use rand::rngs::OsRng;
use rand::RngCore;

/// Default cryptographic salt length in bytes (128-bit).
pub const DEFAULT_SALT_LENGTH: usize = 16;
/// Minimum allowed salt length in bytes.
pub const MIN_SALT_LENGTH: usize = 16;
/// Maximum allowed salt length in bytes.
pub const MAX_SALT_LENGTH: usize = 64;

/// Strongly typed cryptographic salt container.
#[derive(Clone, PartialEq, Eq)]
pub struct Salt {
    bytes: Vec<u8>,
}

impl Salt {
    /// Creates a new Salt instance from an existing byte slice after validating length.
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, AppError> {
        if bytes.len() < MIN_SALT_LENGTH {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Salt length {} is too short (minimum {} bytes required)",
                bytes.len(),
                MIN_SALT_LENGTH
            )));
        }
        if bytes.len() > MAX_SALT_LENGTH {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Salt length {} exceeds maximum allowed ({} bytes)",
                bytes.len(),
                MAX_SALT_LENGTH
            )));
        }
        Ok(Self {
            bytes: bytes.to_vec(),
        })
    }

    /// Generates a cryptographically secure random salt of the default length (16 bytes).
    pub fn generate() -> Result<Self, AppError> {
        Self::generate_with_length(DEFAULT_SALT_LENGTH)
    }

    /// Generates a cryptographically secure random salt of specified length.
    pub fn generate_with_length(length: usize) -> Result<Self, AppError> {
        if length < MIN_SALT_LENGTH || length > MAX_SALT_LENGTH {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Requested salt length {} is outside allowable range [{}, {}]",
                length, MIN_SALT_LENGTH, MAX_SALT_LENGTH
            )));
        }

        let mut bytes = vec![0u8; length];
        let mut rng = OsRng;
        rng.try_fill_bytes(&mut bytes).map_err(|e| {
            AppError::RandomGenerationFailed(format!("Failed to generate secure random salt: {}", e))
        })?;

        Ok(Self { bytes })
    }

    /// Exposes salt bytes for key derivation or encrypted file header encoding.
    pub fn as_bytes(&self) -> &[u8] {
        &self.bytes
    }

    /// Salt length in bytes.
    pub fn len(&self) -> usize {
        self.bytes.len()
    }

    /// Returns true if empty.
    pub fn is_empty(&self) -> bool {
        self.bytes.is_empty()
    }
}

// Custom Debug implementation to prevent dumping raw salt bytes into standard loggers
impl std::fmt::Debug for Salt {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Salt")
            .field("length_bytes", &self.bytes.len())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_default_salt() {
        let salt = Salt::generate().expect("Failed to generate salt");
        assert_eq!(salt.len(), DEFAULT_SALT_LENGTH);
        assert!(!salt.as_bytes().iter().all(|&b| b == 0));
    }

    #[test]
    fn test_unique_salts() {
        let salt1 = Salt::generate().expect("Salt 1 failed");
        let salt2 = Salt::generate().expect("Salt 2 failed");
        assert_ne!(salt1.as_bytes(), salt2.as_bytes());
    }

    #[test]
    fn test_salt_custom_length_validation() {
        assert!(Salt::generate_with_length(8).is_err());
        assert!(Salt::generate_with_length(128).is_err());
        let salt32 = Salt::generate_with_length(32).expect("32-byte salt failed");
        assert_eq!(salt32.len(), 32);
    }
}
