use std::io::{Read, Write};
use serde::{Deserialize, Serialize};

use crate::crypto::key_derivation::Argon2ParamsConfig;
use crate::crypto::nonce::BaseNonce;
use crate::crypto::random::Salt;
use crate::errors::AppError;

/// Magic identification bytes for the Aegis Encrypted Container format ("AEGIS").
pub const MAGIC_BYTES: &[u8; 5] = b"AEGIS";

/// Current supported file format version.
pub const CURRENT_FORMAT_VERSION: u8 = 1;

/// Cryptographic cipher suite identifier: XChaCha20-Poly1305 (256-bit key, 192-bit nonce, 128-bit tag).
pub const ALGORITHM_XCHACHA20_POLY1305: u8 = 1;

/// Key derivation function identifier: Argon2id (RFC 9106).
pub const KDF_ARGON2ID: u8 = 1;

/// Nonce derivation strategy identifier: Sequential chunk counter over 192-bit BaseNonce.
pub const NONCE_STRATEGY_SEQUENTIAL: u8 = 1;

/// Default streaming encryption chunk size in bytes (64 KiB).
pub const DEFAULT_CHUNK_SIZE: u32 = 64 * 1024;

/// Minimum allowable chunk size in bytes (4 KiB).
pub const MIN_CHUNK_SIZE: u32 = 4 * 1024;

/// Maximum allowable chunk size in bytes (16 MiB).
pub const MAX_CHUNK_SIZE: u32 = 16 * 1024 * 1024;

/// Maximum allowable serialized metadata size in bytes (64 KiB limit to prevent memory exhaustion).
pub const MAX_METADATA_SIZE: usize = 64 * 1024;

/// Maximum allowable header size in bytes.
pub const MAX_HEADER_SIZE: usize = 128 * 1024;

/// Original file metadata packaged and authenticated inside the encrypted container.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OriginalFileMetadata {
    pub file_name: String,
    pub file_size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extension: Option<String>,
    pub created_at: String,
}

impl OriginalFileMetadata {
    pub fn new(file_name: String, file_size: u64) -> Self {
        let extension = std::path::Path::new(&file_name)
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_string());

        Self {
            file_name,
            file_size,
            extension,
            created_at: chrono::Utc::now().to_rfc3339(),
        }
    }
}

/// Parsed or constructed Aegis encrypted file header.
#[derive(Clone, PartialEq, Eq)]
pub struct EncryptedFileHeader {
    pub version: u8,
    pub algorithm_id: u8,
    pub kdf_id: u8,
    pub nonce_strategy_id: u8,
    pub argon2_params: Argon2ParamsConfig,
    pub salt: Salt,
    pub base_nonce: BaseNonce,
    pub chunk_size: u32,
    pub encrypted_metadata: Vec<u8>,
}

impl EncryptedFileHeader {
    /// Creates a new header instance with validated fields.
    pub fn new(
        argon2_params: Argon2ParamsConfig,
        salt: Salt,
        base_nonce: BaseNonce,
        chunk_size: u32,
        encrypted_metadata: Vec<u8>,
    ) -> Result<Self, AppError> {
        if chunk_size < MIN_CHUNK_SIZE || chunk_size > MAX_CHUNK_SIZE {
            return Err(AppError::InvalidChunkConfiguration(format!(
                "Chunk size {} is outside allowable range [{}, {}]",
                chunk_size, MIN_CHUNK_SIZE, MAX_CHUNK_SIZE
            )));
        }

        if encrypted_metadata.len() > MAX_METADATA_SIZE {
            return Err(AppError::HeaderCreationFailed(format!(
                "Encrypted metadata length {} exceeds maximum allowable {}",
                encrypted_metadata.len(),
                MAX_METADATA_SIZE
            )));
        }

        Ok(Self {
            version: CURRENT_FORMAT_VERSION,
            algorithm_id: ALGORITHM_XCHACHA20_POLY1305,
            kdf_id: KDF_ARGON2ID,
            nonce_strategy_id: NONCE_STRATEGY_SEQUENTIAL,
            argon2_params,
            salt,
            base_nonce,
            chunk_size,
            encrypted_metadata,
        })
    }

    /// Generates the fixed-size binary preamble used for parsing and AAD calculation.
    pub fn build_preamble(&self) -> Vec<u8> {
        let mut preamble = Vec::with_capacity(64);
        preamble.extend_from_slice(MAGIC_BYTES);
        preamble.push(self.version);
        preamble.push(self.algorithm_id);
        preamble.push(self.kdf_id);
        preamble.push(self.nonce_strategy_id);

        // Argon2 Parameters (4 bytes each, Big-Endian)
        preamble.extend_from_slice(&self.argon2_params.memory_cost_kib.to_be_bytes());
        preamble.extend_from_slice(&self.argon2_params.time_cost_iterations.to_be_bytes());
        preamble.extend_from_slice(&self.argon2_params.parallelism_threads.to_be_bytes());

        // Salt (1 byte length + salt bytes)
        let salt_bytes = self.salt.as_bytes();
        preamble.push(salt_bytes.len() as u8);
        preamble.extend_from_slice(salt_bytes);

        // Base Nonce (24 bytes)
        preamble.extend_from_slice(self.base_nonce.as_bytes());

        // Chunk Size (4 bytes, Big-Endian)
        preamble.extend_from_slice(&self.chunk_size.to_be_bytes());

        preamble
    }

    /// Serializes the entire header (preamble + encrypted metadata length + encrypted metadata) to a writer.
    pub fn write_to<W: Write>(&self, writer: &mut W) -> Result<usize, AppError> {
        let preamble = self.build_preamble();
        let mut total_written = 0;

        writer.write_all(&preamble).map_err(|e| {
            AppError::HeaderWriteFailed(format!("Failed to write header preamble: {}", e))
        })?;
        total_written += preamble.len();

        let meta_len = self.encrypted_metadata.len() as u32;
        writer.write_all(&meta_len.to_be_bytes()).map_err(|e| {
            AppError::HeaderWriteFailed(format!("Failed to write metadata length: {}", e))
        })?;
        total_written += 4;

        if !self.encrypted_metadata.is_empty() {
            writer
                .write_all(&self.encrypted_metadata)
                .map_err(|e| AppError::HeaderWriteFailed(format!("Failed to write encrypted metadata: {}", e)))?;
            total_written += self.encrypted_metadata.len();
        }

        Ok(total_written)
    }

    /// Reads and parses an EncryptedFileHeader from a reader with strict validation.
    pub fn read_from<R: Read>(reader: &mut R) -> Result<Self, AppError> {
        // 1. Read & Validate Magic Bytes (5 bytes)
        let mut magic = [0u8; 5];
        reader.read_exact(&mut magic).map_err(|e| {
            AppError::ValidationError(format!("Failed to read magic bytes or file too small: {}", e))
        })?;
        if &magic != MAGIC_BYTES {
            return Err(AppError::ValidationError(
                "Invalid file format: Magic bytes do not match Aegis container format.".to_string(),
            ));
        }

        // 2. Read Version (1 byte)
        let mut version_buf = [0u8; 1];
        reader
            .read_exact(&mut version_buf)
            .map_err(|e| AppError::ValidationError(format!("Failed to read version byte: {}", e)))?;
        let version = version_buf[0];
        if version != CURRENT_FORMAT_VERSION {
            return Err(AppError::ValidationError(format!(
                "Unsupported file format version: {} (supported version: {})",
                version, CURRENT_FORMAT_VERSION
            )));
        }

        // 3. Read Cipher Suite & KDF & Nonce Strategy (3 bytes)
        let mut ids_buf = [0u8; 3];
        reader
            .read_exact(&mut ids_buf)
            .map_err(|e| AppError::ValidationError(format!("Failed to read algorithm IDs: {}", e)))?;
        let algorithm_id = ids_buf[0];
        let kdf_id = ids_buf[1];
        let nonce_strategy_id = ids_buf[2];

        if algorithm_id != ALGORITHM_XCHACHA20_POLY1305 {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Unsupported encryption algorithm identifier: {}",
                algorithm_id
            )));
        }

        if kdf_id != KDF_ARGON2ID {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Unsupported KDF identifier: {}",
                kdf_id
            )));
        }

        if nonce_strategy_id != NONCE_STRATEGY_SEQUENTIAL {
            return Err(AppError::InvalidCryptoConfiguration(format!(
                "Unsupported nonce strategy identifier: {}",
                nonce_strategy_id
            )));
        }

        // 4. Read Argon2 Parameters (12 bytes)
        let mut m_cost_buf = [0u8; 4];
        let mut t_cost_buf = [0u8; 4];
        let mut p_cost_buf = [0u8; 4];
        reader.read_exact(&mut m_cost_buf).map_err(|e| {
            AppError::ValidationError(format!("Failed to read Argon2 m_cost: {}", e))
        })?;
        reader.read_exact(&mut t_cost_buf).map_err(|e| {
            AppError::ValidationError(format!("Failed to read Argon2 t_cost: {}", e))
        })?;
        reader.read_exact(&mut p_cost_buf).map_err(|e| {
            AppError::ValidationError(format!("Failed to read Argon2 p_cost: {}", e))
        })?;

        let argon2_params = Argon2ParamsConfig::new(
            u32::from_be_bytes(m_cost_buf),
            u32::from_be_bytes(t_cost_buf),
            u32::from_be_bytes(p_cost_buf),
        )?;

        // 5. Read Salt (1 byte len + bytes)
        let mut salt_len_buf = [0u8; 1];
        reader.read_exact(&mut salt_len_buf).map_err(|e| {
            AppError::ValidationError(format!("Failed to read salt length: {}", e))
        })?;
        let salt_len = salt_len_buf[0] as usize;
        let mut salt_bytes = vec![0u8; salt_len];
        reader.read_exact(&mut salt_bytes).map_err(|e| {
            AppError::ValidationError(format!("Failed to read salt bytes: {}", e))
        })?;
        let salt = Salt::from_bytes(&salt_bytes)?;

        // 6. Read Base Nonce (24 bytes)
        let mut base_nonce_bytes = [0u8; 24];
        reader.read_exact(&mut base_nonce_bytes).map_err(|e| {
            AppError::ValidationError(format!("Failed to read base nonce: {}", e))
        })?;
        let base_nonce = BaseNonce::from_bytes(&base_nonce_bytes)?;

        // 7. Read Chunk Size (4 bytes)
        let mut chunk_size_buf = [0u8; 4];
        reader.read_exact(&mut chunk_size_buf).map_err(|e| {
            AppError::ValidationError(format!("Failed to read chunk size: {}", e))
        })?;
        let chunk_size = u32::from_be_bytes(chunk_size_buf);
        if chunk_size < MIN_CHUNK_SIZE || chunk_size > MAX_CHUNK_SIZE {
            return Err(AppError::InvalidChunkConfiguration(format!(
                "Header chunk size {} is outside allowable range [{}, {}]",
                chunk_size, MIN_CHUNK_SIZE, MAX_CHUNK_SIZE
            )));
        }

        // 8. Read Encrypted Metadata Length (4 bytes)
        let mut meta_len_buf = [0u8; 4];
        reader.read_exact(&mut meta_len_buf).map_err(|e| {
            AppError::ValidationError(format!("Failed to read metadata length: {}", e))
        })?;
        let meta_len = u32::from_be_bytes(meta_len_buf) as usize;
        if meta_len > MAX_METADATA_SIZE {
            return Err(AppError::ValidationError(format!(
                "Header metadata length {} exceeds maximum allowable limit {}",
                meta_len, MAX_METADATA_SIZE
            )));
        }

        // 9. Read Encrypted Metadata Bytes
        let mut encrypted_metadata = vec![0u8; meta_len];
        if meta_len > 0 {
            reader.read_exact(&mut encrypted_metadata).map_err(|e| {
                AppError::ValidationError(format!("Failed to read encrypted metadata payload: {}", e))
            })?;
        }

        Ok(Self {
            version,
            algorithm_id,
            kdf_id,
            nonce_strategy_id,
            argon2_params,
            salt,
            base_nonce,
            chunk_size,
            encrypted_metadata,
        })
    }
}

impl std::fmt::Debug for EncryptedFileHeader {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("EncryptedFileHeader")
            .field("version", &self.version)
            .field("algorithm_id", &self.algorithm_id)
            .field("kdf_id", &self.kdf_id)
            .field("nonce_strategy_id", &self.nonce_strategy_id)
            .field("chunk_size", &self.chunk_size)
            .field("metadata_len", &self.encrypted_metadata.len())
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_header_serialization_and_parsing() {
        let params = Argon2ParamsConfig::default();
        let salt = Salt::generate().expect("Salt");
        let nonce = BaseNonce::generate().expect("Nonce");
        let fake_meta = vec![1, 2, 3, 4, 5, 6, 7, 8];

        let header = EncryptedFileHeader::new(
            params,
            salt,
            nonce,
            DEFAULT_CHUNK_SIZE,
            fake_meta.clone(),
        )
        .expect("Valid header");

        let mut buffer = Vec::new();
        let written = header.write_to(&mut buffer).expect("Write header");
        assert!(written > 50);

        let mut cursor = std::io::Cursor::new(buffer);
        let parsed = EncryptedFileHeader::read_from(&mut cursor).expect("Read header");

        assert_eq!(parsed.version, CURRENT_FORMAT_VERSION);
        assert_eq!(parsed.algorithm_id, ALGORITHM_XCHACHA20_POLY1305);
        assert_eq!(parsed.chunk_size, DEFAULT_CHUNK_SIZE);
        assert_eq!(parsed.encrypted_metadata, fake_meta);
    }

    #[test]
    fn test_invalid_magic_rejection() {
        let mut bad_bytes = vec![0u8; 60];
        bad_bytes[0..5].copy_from_slice(b"CORPT");
        let mut cursor = std::io::Cursor::new(bad_bytes);
        assert!(EncryptedFileHeader::read_from(&mut cursor).is_err());
    }

    #[test]
    fn test_unsupported_version_rejection() {
        let params = Argon2ParamsConfig::default();
        let salt = Salt::generate().expect("Salt");
        let nonce = BaseNonce::generate().expect("Nonce");
        let mut header = EncryptedFileHeader::new(
            params,
            salt,
            nonce,
            DEFAULT_CHUNK_SIZE,
            vec![],
        )
        .unwrap();
        header.version = 99;

        let mut buffer = Vec::new();
        header.write_to(&mut buffer).unwrap();

        let mut cursor = std::io::Cursor::new(buffer);
        assert!(EncryptedFileHeader::read_from(&mut cursor).is_err());
    }
}
