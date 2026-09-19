use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;

use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use serde::{Deserialize, Serialize};

use crate::crypto::format::{
    EncryptedFileHeader, OriginalFileMetadata, ALGORITHM_XCHACHA20_POLY1305, KDF_ARGON2ID,
    MAGIC_BYTES,
};
use crate::crypto::key_derivation::DerivedKey;
use crate::crypto::nonce::{METADATA_CHUNK_INDEX, XCHACHA20_NONCE_LENGTH};
use crate::errors::AppError;

/// Authentication tag length in bytes for Poly1305.
pub const POLY1305_TAG_LENGTH: usize = 16;

/// Progress update callback signature for streaming decryption: (bytes_processed, total_bytes).
pub type DecryptionProgressCallback<'a> = &'a mut dyn FnMut(u64, u64);

/// Cancellation check callback signature. Returns true if cancelled.
pub type CancellationCheck<'a> = &'a dyn Fn() -> bool;

/// Encrypted file detection summary information returned to the application.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EncryptedFileDetectionResult {
    pub is_encrypted: bool,
    pub format_version: Option<u8>,
    pub algorithm: Option<String>,
    pub kdf: Option<String>,
    pub chunk_size: Option<u32>,
    pub error: Option<String>,
}

/// Detects whether a file appears to be a valid Aegis encrypted container by inspecting its magic header and structure.
/// Reads only the minimal preamble without loading entire contents into memory.
pub fn detect_encrypted_file(path: &Path) -> Result<EncryptedFileDetectionResult, AppError> {
    if !path.exists() {
        return Err(AppError::FileNotFound(format!("File not found: {:?}", path)));
    }

    let file = File::open(path).map_err(|e| {
        AppError::FileAccessDenied(format!("Failed to open file for detection: {}", e))
    })?;

    let file_size = file
        .metadata()
        .map_err(|e| AppError::MetadataUnavailable(format!("Could not read file metadata: {}", e)))?
        .len();

    // Minimum header size is 5 (magic) + 1 (ver) + 3 (ids) + 12 (argon2) + 1 + 16 (salt) + 24 (nonce) + 4 (chunk_size) + 4 (meta_len) = 70 bytes
    if file_size < 70 {
        return Ok(EncryptedFileDetectionResult {
            is_encrypted: false,
            format_version: None,
            algorithm: None,
            kdf: None,
            chunk_size: None,
            error: Some("File is too small to contain a valid encrypted header".to_string()),
        });
    }

    let mut reader = BufReader::new(file);

    // 1. Check Magic Bytes
    let mut magic = [0u8; 5];
    if let Err(e) = reader.read_exact(&mut magic) {
        return Ok(EncryptedFileDetectionResult {
            is_encrypted: false,
            format_version: None,
            algorithm: None,
            kdf: None,
            chunk_size: None,
            error: Some(format!("Failed to read magic bytes: {}", e)),
        });
    }

    if &magic != MAGIC_BYTES {
        return Ok(EncryptedFileDetectionResult {
            is_encrypted: false,
            format_version: None,
            algorithm: None,
            kdf: None,
            chunk_size: None,
            error: Some("Magic identification bytes do not match Aegis format".to_string()),
        });
    }

    // 2. Read Version
    let mut version_buf = [0u8; 1];
    if let Err(e) = reader.read_exact(&mut version_buf) {
        return Ok(EncryptedFileDetectionResult {
            is_encrypted: true,
            format_version: None,
            algorithm: None,
            kdf: None,
            chunk_size: None,
            error: Some(format!("Failed to read format version: {}", e)),
        });
    }
    let version = version_buf[0];

    // 3. Read Algorithm IDs
    let mut ids_buf = [0u8; 3];
    if let Err(e) = reader.read_exact(&mut ids_buf) {
        return Ok(EncryptedFileDetectionResult {
            is_encrypted: true,
            format_version: Some(version),
            algorithm: None,
            kdf: None,
            chunk_size: None,
            error: Some(format!("Failed to read algorithm IDs: {}", e)),
        });
    }

    let algorithm_str = if ids_buf[0] == ALGORITHM_XCHACHA20_POLY1305 {
        "XChaCha20-Poly1305".to_string()
    } else {
        format!("Unknown ({})", ids_buf[0])
    };

    let kdf_str = if ids_buf[1] == KDF_ARGON2ID {
        "Argon2id".to_string()
    } else {
        format!("Unknown ({})", ids_buf[1])
    };

    Ok(EncryptedFileDetectionResult {
        is_encrypted: true,
        format_version: Some(version),
        algorithm: Some(algorithm_str),
        kdf: Some(kdf_str),
        chunk_size: None,
        error: None,
    })
}

/// Decrypts and authenticates a ciphertext slice with XChaCha20-Poly1305 using derived key, nonce, and AAD.
pub fn decrypt_chunk(
    key: &DerivedKey,
    nonce_bytes: &[u8; XCHACHA20_NONCE_LENGTH],
    aad: &[u8],
    ciphertext: &[u8],
) -> Result<Vec<u8>, AppError> {
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_bytes()).map_err(|e| {
        AppError::CryptographicOperationFailed(format!("Failed to initialize cipher: {}", e))
    })?;

    let nonce = XNonce::from_slice(nonce_bytes);
    let payload = Payload {
        msg: ciphertext,
        aad,
    };

    cipher.decrypt(nonce, payload).map_err(|_| {
        AppError::AuthenticationFailed(
            "Authentication failed: Incorrect password or corrupted encrypted payload".to_string(),
        )
    })
}

/// Reconstructs AAD for a given chunk index and last_chunk flag.
pub fn build_chunk_aad(chunk_index: u64, is_last_chunk: bool) -> [u8; 9] {
    let mut aad = [0u8; 9];
    aad[0..8].copy_from_slice(&chunk_index.to_be_bytes());
    aad[8] = if is_last_chunk { 1 } else { 0 };
    aad
}

/// Recovers and validates original file metadata from the parsed encrypted container header.
pub fn recover_authenticated_metadata(
    header: &EncryptedFileHeader,
    key: &DerivedKey,
) -> Result<OriginalFileMetadata, AppError> {
    let meta_nonce = header.base_nonce.derive_chunk_nonce(METADATA_CHUNK_INDEX);

    // Reconstruct preamble AAD exactly as built during encryption
    let dummy_header = EncryptedFileHeader::new(
        header.argon2_params.clone(),
        header.salt.clone(),
        header.base_nonce.clone(),
        header.chunk_size,
        vec![],
    )?;
    let preamble_aad = dummy_header.build_preamble();

    let decrypted_meta_bytes = decrypt_chunk(
        key,
        &meta_nonce,
        &preamble_aad,
        &header.encrypted_metadata,
    )
    .map_err(|_| {
        AppError::AuthenticationFailed(
            "Metadata authentication failed: Invalid password or corrupted header".to_string(),
        )
    })?;

    let mut meta: OriginalFileMetadata = serde_json::from_slice(&decrypted_meta_bytes).map_err(|e| {
        AppError::InvalidMetadata(format!("Failed to parse authenticated metadata JSON: {}", e))
    })?;

    // Sanitize filename to prevent path traversal vulnerabilities
    let raw_name = meta.file_name.trim();
    let sanitized_name = Path::new(raw_name)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.replace(['/', '\\', '\0'], "_"))
        .filter(|s| !s.is_empty() && s != ".." && s != ".")
        .unwrap_or_else(|| "decrypted_file".to_string());

    meta.file_name = sanitized_name;
    Ok(meta)
}

/// Decrypts an encrypted container file stream from `input_path` to `output_temp_path`.
///
/// Features:
/// - Streams chunks with bounded memory consumption (buffer size equals chunk size).
/// - Validates header and metadata authentication before processing data.
/// - Authenticates each chunk with XChaCha20-Poly1305 and unique sequential chunk nonces.
/// - Validates final decrypted size against authenticated metadata.
/// - Supports cooperative cancellation between chunks.
/// - Returns `(total_encrypted_bytes_read, total_decrypted_bytes)`.
pub fn decrypt_file_stream(
    input_path: &Path,
    output_temp_path: &Path,
    key: &DerivedKey,
    header: &EncryptedFileHeader,
    expected_plaintext_size: u64,
    progress_callback: Option<DecryptionProgressCallback>,
    is_cancelled: Option<CancellationCheck>,
) -> Result<(u64, u64), AppError> {
    let input_file = File::open(input_path).map_err(|e| {
        AppError::FileAccessDenied(format!("Failed to open encrypted file for reading: {}", e))
    })?;

    let total_file_size = input_file
        .metadata()
        .map_err(|e| AppError::MetadataUnavailable(format!("Could not read file metadata: {}", e)))?
        .len();

    let output_file = File::create(output_temp_path).map_err(|e| {
        AppError::OutputWriteFailed(format!(
            "Failed to create temporary output file: {}",
            e
        ))
    })?;

    let chunk_size = header.chunk_size;
    let mut reader = BufReader::with_capacity((chunk_size as usize) + 4096, input_file);
    let mut writer = BufWriter::with_capacity(chunk_size as usize, output_file);

    // Read and skip the header since it was already parsed
    let _ = EncryptedFileHeader::read_from(&mut reader)?;

    let mut chunk_index: u64 = 1;
    let mut total_encrypted_bytes_read: u64 = 0;
    let mut total_decrypted_bytes: u64 = 0;
    let mut callback_slot = progress_callback;

    let max_cipher_chunk_len = (header.chunk_size as usize) + POLY1305_TAG_LENGTH + 1024;

    loop {
        // 1. Cooperative Cancellation Check
        if let Some(check_fn) = is_cancelled {
            if check_fn() {
                return Err(AppError::Cancelled("Decryption was cancelled by user".to_string()));
            }
        }

        // 2. Read chunk length (4 bytes Big-Endian)
        let mut chunk_len_buf = [0u8; 4];
        let bytes_read = reader.read(&mut chunk_len_buf).map_err(|e| {
            AppError::FileAccessDenied(format!("Failed to read chunk length: {}", e))
        })?;

        if bytes_read == 0 {
            // Unexpected EOF before reading is_last chunk
            if total_decrypted_bytes < expected_plaintext_size {
                return Err(AppError::TruncatedEncryptedFile(format!(
                    "Encrypted file stream ended prematurely (expected {} bytes, decrypted {})",
                    expected_plaintext_size, total_decrypted_bytes
                )));
            }
            break;
        }

        if bytes_read < 4 {
            return Err(AppError::TruncatedEncryptedFile(
                "Truncated chunk header in encrypted file".to_string(),
            ));
        }

        let chunk_len = u32::from_be_bytes(chunk_len_buf) as usize;
        total_encrypted_bytes_read += 4;

        // Security check: chunk_len must contain at least Poly1305 tag and not exceed maximum allocation
        if chunk_len < POLY1305_TAG_LENGTH || chunk_len > max_cipher_chunk_len {
            return Err(AppError::InvalidChunkConfiguration(format!(
                "Invalid chunk length: {} bytes (allowable range [{}, {}])",
                chunk_len, POLY1305_TAG_LENGTH, max_cipher_chunk_len
            )));
        }

        // 3. Read is_last flag (1 byte)
        let mut flag_buf = [0u8; 1];
        reader.read_exact(&mut flag_buf).map_err(|e| {
            AppError::TruncatedEncryptedFile(format!("Failed to read chunk finality flag: {}", e))
        })?;
        total_encrypted_bytes_read += 1;
        let is_last = flag_buf[0] == 1;

        // 4. Read ciphertext payload
        let mut ciphertext = vec![0u8; chunk_len];
        reader.read_exact(&mut ciphertext).map_err(|e| {
            AppError::TruncatedEncryptedFile(format!("Failed to read chunk payload: {}", e))
        })?;
        total_encrypted_bytes_read += chunk_len as u64;

        // 5. Derive chunk nonce and AAD
        let chunk_nonce = header.base_nonce.derive_chunk_nonce(chunk_index);
        let chunk_aad = build_chunk_aad(chunk_index, is_last);

        // 6. Decrypt and authenticate chunk
        let plaintext_chunk = decrypt_chunk(key, &chunk_nonce, &chunk_aad, &ciphertext)?;

        // 7. Write decrypted plaintext to temporary output
        if !plaintext_chunk.is_empty() {
            writer.write_all(&plaintext_chunk).map_err(|e| {
                AppError::OutputWriteFailed(format!("Failed to write decrypted plaintext chunk: {}", e))
            })?;
        }

        total_decrypted_bytes += plaintext_chunk.len() as u64;

        // 8. Trigger progress callback
        if let Some(ref mut cb) = callback_slot {
            cb(total_encrypted_bytes_read, total_file_size);
        }

        // 9. If last chunk, verify and break
        if is_last {
            // Check for unexpected trailing data
            let mut trailing_byte = [0u8; 1];
            if let Ok(trailing_count) = reader.read(&mut trailing_byte) {
                if trailing_count > 0 {
                    return Err(AppError::MalformedEncryptedFile(
                        "Encrypted file contains unexpected trailing bytes after final chunk".to_string(),
                    ));
                }
            }
            break;
        }

        chunk_index = chunk_index.checked_add(1).ok_or_else(|| {
            AppError::InvalidChunkConfiguration("Chunk index exceeded 64-bit bounds".to_string())
        })?;
    }

    // Flush writer
    writer.flush().map_err(|e| {
        AppError::OutputWriteFailed(format!("Failed to flush decrypted output stream: {}", e))
    })?;

    // 10. Validate recovered plaintext size matches authenticated metadata
    if total_decrypted_bytes != expected_plaintext_size {
        return Err(AppError::DecryptedSizeMismatch(format!(
            "Decrypted plaintext size mismatch: recovered {} bytes, expected {} bytes from authenticated metadata",
            total_decrypted_bytes, expected_plaintext_size
        )));
    }

    Ok((total_encrypted_bytes_read, total_decrypted_bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use crate::crypto::encryption::{encrypt_chunk, encrypt_file_stream};
    use crate::crypto::format::CURRENT_FORMAT_VERSION;
    use crate::crypto::key_derivation::{derive_key_argon2id, Argon2ParamsConfig};
    use crate::crypto::nonce::BaseNonce;
    use crate::crypto::random::Salt;

    #[test]
    fn test_decrypt_chunk_tamper_detection() {
        let key = DerivedKey::new([0x33u8; 32]);
        let nonce = [0x55u8; 24];
        let aad = b"test-aad-context";
        let plaintext = b"Confidential financial payload";

        let mut ciphertext = encrypt_chunk(&key, &nonce, aad, plaintext).unwrap();

        // 1. Success on untouched ciphertext
        let decrypted = decrypt_chunk(&key, &nonce, aad, &ciphertext).unwrap();
        assert_eq!(decrypted, plaintext);

        // 2. Tampering 1 byte in ciphertext fails authentication
        ciphertext[5] ^= 0x08;
        assert!(decrypt_chunk(&key, &nonce, aad, &ciphertext).is_err());
    }

    #[test]
    fn test_wrong_password_causes_authentication_failure() {
        let key_correct = DerivedKey::new([0x11u8; 32]);
        let key_wrong = DerivedKey::new([0x22u8; 32]);
        let nonce = [0x77u8; 24];
        let aad = b"context";
        let plaintext = b"Sensitive data";

        let ciphertext = encrypt_chunk(&key_correct, &nonce, aad, plaintext).unwrap();
        let err = decrypt_chunk(&key_wrong, &nonce, aad, &ciphertext).unwrap_err();
        match err {
            AppError::AuthenticationFailed(_) => {}
            _ => panic!("Expected AuthenticationFailed error, got {:?}", err),
        }
    }

    #[test]
    fn test_empty_file_roundtrip_decryption() {
        let input_temp = NamedTempFile::new().unwrap();
        let enc_temp = NamedTempFile::new().unwrap();
        let dec_temp = NamedTempFile::new().unwrap();

        let password = "SuperSecretPassword123!";
        let salt = Salt::generate().unwrap();
        let params = Argon2ParamsConfig::default();
        let key = derive_key_argon2id(password, salt.as_bytes(), Some(&params)).unwrap();

        // Encrypt empty file
        encrypt_file_stream(
            input_temp.path(),
            enc_temp.path(),
            &key,
            salt,
            params,
            crate::crypto::format::DEFAULT_CHUNK_SIZE,
            None,
            None,
        )
        .expect("Encryption failed");

        // Read header
        let mut enc_file = File::open(enc_temp.path()).unwrap();
        let header = EncryptedFileHeader::read_from(&mut enc_file).unwrap();

        let recovered_key = derive_key_argon2id(password, header.salt.as_bytes(), Some(&header.argon2_params)).unwrap();
        let metadata = recover_authenticated_metadata(&header, &recovered_key).unwrap();
        assert_eq!(metadata.file_size, 0);

        // Decrypt empty file
        let (enc_read, dec_written) = decrypt_file_stream(
            enc_temp.path(),
            dec_temp.path(),
            &recovered_key,
            &header,
            metadata.file_size,
            None,
            None,
        )
        .expect("Decryption failed");

        assert_eq!(dec_written, 0);
        assert!(enc_read > 0);
        let dec_bytes = std::fs::read(dec_temp.path()).unwrap();
        assert!(dec_bytes.is_empty());
    }

    #[test]
    fn test_multi_chunk_roundtrip_byte_exact() {
        let mut input_temp = NamedTempFile::new().unwrap();
        let enc_temp = NamedTempFile::new().unwrap();
        let dec_temp = NamedTempFile::new().unwrap();

        // Write 150 KiB (exceeds default 64 KiB chunk size, producing 3 chunks)
        let mut sample_data = Vec::with_capacity(150 * 1024);
        for i in 0..(150 * 1024) {
            sample_data.push((i % 251) as u8);
        }
        input_temp.write_all(&sample_data).unwrap();
        input_temp.flush().unwrap();

        let password = "MultiChunkPassword456!";
        let salt = Salt::generate().unwrap();
        let params = Argon2ParamsConfig::default();
        let key = derive_key_argon2id(password, salt.as_bytes(), Some(&params)).unwrap();

        // Encrypt
        encrypt_file_stream(
            input_temp.path(),
            enc_temp.path(),
            &key,
            salt,
            params,
            crate::crypto::format::DEFAULT_CHUNK_SIZE,
            None,
            None,
        )
        .expect("Streaming encryption");

        // Parse header
        let mut enc_file = File::open(enc_temp.path()).unwrap();
        let header = EncryptedFileHeader::read_from(&mut enc_file).unwrap();
        let recovered_key = derive_key_argon2id(password, header.salt.as_bytes(), Some(&header.argon2_params)).unwrap();
        let metadata = recover_authenticated_metadata(&header, &recovered_key).unwrap();
        assert_eq!(metadata.file_size, sample_data.len() as u64);

        // Decrypt
        let (_enc_read, dec_written) = decrypt_file_stream(
            enc_temp.path(),
            dec_temp.path(),
            &recovered_key,
            &header,
            metadata.file_size,
            None,
            None,
        )
        .expect("Streaming decryption");

        assert_eq!(dec_written, sample_data.len() as u64);
        let decrypted_bytes = std::fs::read(dec_temp.path()).unwrap();
        assert_eq!(decrypted_bytes, sample_data);
    }

    #[test]
    fn test_detect_encrypted_file() {
        let mut input_temp = NamedTempFile::new().unwrap();
        let enc_temp = NamedTempFile::new().unwrap();

        input_temp.write_all(b"Plaintext data").unwrap();
        input_temp.flush().unwrap();

        // 1. Plaintext file detection
        let detect_plain = detect_encrypted_file(input_temp.path()).unwrap();
        assert!(!detect_plain.is_encrypted);

        // 2. Encrypt file
        let password = "TestPassword123!";
        let salt = Salt::generate().unwrap();
        let params = Argon2ParamsConfig::default();
        let key = derive_key_argon2id(password, salt.as_bytes(), Some(&params)).unwrap();

        encrypt_file_stream(
            input_temp.path(),
            enc_temp.path(),
            &key,
            salt,
            params,
            crate::crypto::format::DEFAULT_CHUNK_SIZE,
            None,
            None,
        )
        .unwrap();

        // 3. Encrypted file detection
        let detect_enc = detect_encrypted_file(enc_temp.path()).unwrap();
        assert!(detect_enc.is_encrypted);
        assert_eq!(detect_enc.format_version, Some(CURRENT_FORMAT_VERSION));
        assert_eq!(detect_enc.algorithm.as_deref(), Some("XChaCha20-Poly1305"));
        assert_eq!(detect_enc.kdf.as_deref(), Some("Argon2id"));
    }
}
