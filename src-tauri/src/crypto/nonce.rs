use crate::errors::AppError;
use rand::rngs::OsRng;
use rand::RngCore;

/// Length of XChaCha20-Poly1305 nonce in bytes (192 bits).
pub const XCHACHA20_NONCE_LENGTH: usize = 24;

/// Reserved chunk index for file metadata encryption/authentication.
pub const METADATA_CHUNK_INDEX: u64 = 0;

/// Base Nonce container for streaming XChaCha20-Poly1305 encryption.
#[derive(Clone, PartialEq, Eq)]
pub struct BaseNonce {
    bytes: [u8; XCHACHA20_NONCE_LENGTH],
}

impl BaseNonce {
    /// Generates a cryptographically secure random 24-byte base nonce using OsRng.
    pub fn generate() -> Result<Self, AppError> {
        let mut bytes = [0u8; XCHACHA20_NONCE_LENGTH];
        let mut rng = OsRng;
        rng.try_fill_bytes(&mut bytes).map_err(|e| {
            AppError::RandomGenerationFailed(format!("Failed to generate secure random nonce: {}", e))
        })?;
        Ok(Self { bytes })
    }

    /// Creates a BaseNonce from a 24-byte slice.
    pub fn from_bytes(slice: &[u8]) -> Result<Self, AppError> {
        if slice.len() != XCHACHA20_NONCE_LENGTH {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Invalid base nonce length: expected {} bytes, received {}",
                XCHACHA20_NONCE_LENGTH,
                slice.len()
            )));
        }
        let mut bytes = [0u8; XCHACHA20_NONCE_LENGTH];
        bytes.copy_from_slice(slice);
        Ok(Self { bytes })
    }

    /// Exposes the underlying 24-byte array.
    pub fn as_bytes(&self) -> &[u8; XCHACHA20_NONCE_LENGTH] {
        &self.bytes
    }

    /// Derives a deterministic, strictly unique 24-byte nonce for a given chunk index.
    ///
    /// Construction:
    /// - Bytes 0..16: 128-bit random prefix from BaseNonce.
    /// - Bytes 16..24: BaseNonce suffix (64-bit Big-Endian) wrapping-added with `chunk_index`.
    ///
    /// This guarantees that every chunk index `0, 1, 2, ...` receives a distinct 24-byte nonce
    /// under the same derived key, preventing nonce-reuse hazards.
    pub fn derive_chunk_nonce(&self, chunk_index: u64) -> [u8; XCHACHA20_NONCE_LENGTH] {
        let mut chunk_nonce = [0u8; XCHACHA20_NONCE_LENGTH];
        chunk_nonce[0..16].copy_from_slice(&self.bytes[0..16]);

        let base_suffix = u64::from_be_bytes(
            self.bytes[16..24]
                .try_into()
                .expect("Valid 8-byte slice from 24-byte array"),
        );
        let derived_suffix = base_suffix.wrapping_add(chunk_index);
        chunk_nonce[16..24].copy_from_slice(&derived_suffix.to_be_bytes());

        chunk_nonce
    }
}

impl std::fmt::Debug for BaseNonce {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BaseNonce")
            .field("length_bytes", &XCHACHA20_NONCE_LENGTH)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_base_nonce() {
        let nonce = BaseNonce::generate().expect("Failed to generate BaseNonce");
        assert_eq!(nonce.as_bytes().len(), XCHACHA20_NONCE_LENGTH);
        assert!(!nonce.as_bytes().iter().all(|&b| b == 0));
    }

    #[test]
    fn test_unique_base_nonces() {
        let n1 = BaseNonce::generate().expect("Nonce 1");
        let n2 = BaseNonce::generate().expect("Nonce 2");
        assert_ne!(n1.as_bytes(), n2.as_bytes());
    }

    #[test]
    fn test_derive_chunk_nonces_unique_sequence() {
        let base = BaseNonce::generate().expect("Base nonce");
        let nonce_metadata = base.derive_chunk_nonce(0);
        let nonce_chunk1 = base.derive_chunk_nonce(1);
        let nonce_chunk2 = base.derive_chunk_nonce(2);
        let nonce_chunk1000 = base.derive_chunk_nonce(1000);

        assert_ne!(nonce_metadata, nonce_chunk1);
        assert_ne!(nonce_chunk1, nonce_chunk2);
        assert_ne!(nonce_chunk2, nonce_chunk1000);

        // Verify deterministic reproducibility
        assert_eq!(base.derive_chunk_nonce(1), nonce_chunk1);
    }

    #[test]
    fn test_invalid_length_parsing() {
        assert!(BaseNonce::from_bytes(&[0u8; 12]).is_err());
        assert!(BaseNonce::from_bytes(&[0u8; 32]).is_err());
        assert!(BaseNonce::from_bytes(&[0u8; 24]).is_ok());
    }
}
