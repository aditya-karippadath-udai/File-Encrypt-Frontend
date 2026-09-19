use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::Path;

use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};

use crate::crypto::format::{EncryptedFileHeader, OriginalFileMetadata};
use crate::crypto::key_derivation::{Argon2ParamsConfig, DerivedKey};
use crate::crypto::nonce::{BaseNonce, METADATA_CHUNK_INDEX};
use crate::crypto::random::Salt;
use crate::errors::AppError;

/// Authentication tag length in bytes for Poly1305.
pub const POLY1305_TAG_LENGTH: usize = 16;

/// Progress update callback signature for streaming encryption: (bytes_processed, total_bytes).
pub type EncryptionProgressCallback<'a> = &'a mut dyn FnMut(u64, u64);

/// Cancellation check callback signature. Returns true if cancelled.
pub type CancellationCheck<'a> = &'a dyn Fn() -> bool;

/// Encrypts an arbitrary slice of plaintext with XChaCha20-Poly1305 using a derived key, nonce, and AAD.
pub fn encrypt_chunk(
    key: &DerivedKey,
    nonce_bytes: &[u8; 24],
    aad: &[u8],
    plaintext: &[u8],
) -> Result<Vec<u8>, AppError> {
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_bytes()).map_err(|e| {
        AppError::CryptographicOperationFailed(format!("Failed to initialize cipher: {}", e))
    })?;

    let nonce = XNonce::from_slice(nonce_bytes);
    let payload = Payload {
        msg: plaintext,
        aad,
    };

    cipher.encrypt(nonce, payload).map_err(|e| {
        AppError::CryptographicOperationFailed(format!("Chunk encryption failed: {}", e))
    })
}

/// Internal helper for decrypting a chunk (used strictly in unit/integration tests).
#[cfg(test)]
pub fn decrypt_chunk_for_test(
    key: &DerivedKey,
    nonce_bytes: &[u8; 24],
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

    cipher.decrypt(nonce, payload).map_err(|e| {
        AppError::CryptographicOperationFailed(format!("Chunk decryption / authentication failed: {}", e))
    })
}

/// Builds AAD (Additional Authenticated Data) for chunk index `k` and finality flag.
pub fn build_chunk_aad(chunk_index: u64, is_last_chunk: bool) -> [u8; 9] {
    let mut aad = [0u8; 9];
    aad[0..8].copy_from_slice(&chunk_index.to_be_bytes());
    aad[8] = if is_last_chunk { 1 } else { 0 };
    aad
}

/// Streams and encrypts a file from `input_path` to `output_temp_path`.
///
/// Ensures:
/// - Memory is bounded to `chunk_size` buffer.
/// - Original file is opened read-only.
/// - Header contains securely encrypted & authenticated metadata.
/// - Every chunk has a unique derived nonce and authenticated AAD binding index and finality.
/// - Regular cancellation checks between chunks.
pub fn encrypt_file_stream(
    input_path: &Path,
    output_temp_path: &Path,
    key: &DerivedKey,
    salt: Salt,
    argon2_params: Argon2ParamsConfig,
    chunk_size: u32,
    progress_callback: Option<EncryptionProgressCallback>,
    is_cancelled: Option<CancellationCheck>,
) -> Result<(u64, u64), AppError> {
    let input_file = File::open(input_path).map_err(|e| {
        AppError::FileAccessDenied(format!(
            "Failed to open source file for reading: {}",
            e
        ))
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

    let mut reader = BufReader::with_capacity(chunk_size as usize, input_file);
    let mut writer = BufWriter::with_capacity(chunk_size as usize + 4096, output_file);

    // 1. Generate BaseNonce
    let base_nonce = BaseNonce::generate()?;

    // 2. Prepare Original File Metadata
    let file_name = input_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unnamed_file")
        .to_string();

    let meta = OriginalFileMetadata::new(file_name, total_file_size);
    let meta_json = serde_json::to_vec(&meta).map_err(|e| {
        AppError::HeaderCreationFailed(format!("Failed to serialize file metadata: {}", e))
    })?;

    // 3. Encrypt Metadata using dedicated metadata nonce and preamble as AAD
    let meta_nonce = base_nonce.derive_chunk_nonce(METADATA_CHUNK_INDEX);
    let dummy_header = EncryptedFileHeader::new(
        argon2_params.clone(),
        salt.clone(),
        base_nonce.clone(),
        chunk_size,
        vec![],
    )?;
    let preamble = dummy_header.build_preamble();
    let encrypted_metadata = encrypt_chunk(key, &meta_nonce, &preamble, &meta_json)?;

    // 4. Construct Final Header & Write to Output
    let header = EncryptedFileHeader::new(
        argon2_params,
        salt,
        base_nonce.clone(),
        chunk_size,
        encrypted_metadata,
    )?;
    let header_bytes_written = header.write_to(&mut writer)?;
    let mut total_output_bytes = header_bytes_written as u64;

    // 5. Streaming Chunk Encryption Loop
    let mut read_buffer = vec![0u8; chunk_size as usize];
    let mut chunk_index: u64 = 1;
    let mut total_bytes_read: u64 = 0;

    let mut callback_slot = progress_callback;

    loop {
        // Check cancellation
        if let Some(check_fn) = is_cancelled {
            if check_fn() {
                return Err(AppError::Cancelled("Encryption was cancelled by user".to_string()));
            }
        }

        let bytes_read = reader.read(&mut read_buffer).map_err(|e| {
            AppError::FileAccessDenied(format!("Failed to read source file chunk: {}", e))
        })?;

        total_bytes_read += bytes_read as u64;
        let is_last = bytes_read < chunk_size as usize || total_bytes_read >= total_file_size;

        // Encrypt the chunk (even if bytes_read == 0 for empty files on first iteration)
        let chunk_plaintext = &read_buffer[..bytes_read];
        let chunk_nonce = base_nonce.derive_chunk_nonce(chunk_index);
        let chunk_aad = build_chunk_aad(chunk_index, is_last);

        let ciphertext = encrypt_chunk(key, &chunk_nonce, &chunk_aad, chunk_plaintext)?;

        // Write chunk header: [length (4 bytes BE)] + [is_last (1 byte)] + [ciphertext]
        let chunk_len = ciphertext.len() as u32;
        writer.write_all(&chunk_len.to_be_bytes()).map_err(|e| {
            AppError::OutputWriteFailed(format!("Failed to write chunk length: {}", e))
        })?;

        writer.write_all(&[if is_last { 1u8 } else { 0u8 }]).map_err(|e| {
            AppError::OutputWriteFailed(format!("Failed to write chunk flag: {}", e))
        })?;

        writer.write_all(&ciphertext).map_err(|e| {
            AppError::OutputWriteFailed(format!("Failed to write chunk ciphertext: {}", e))
        })?;

        total_output_bytes += 4 + 1 + ciphertext.len() as u64;

        if let Some(ref mut cb) = callback_slot {
            cb(total_bytes_read, total_file_size);
        }

        if is_last {
            break;
        }

        chunk_index = chunk_index.checked_add(1).ok_or_else(|| {
            AppError::InvalidChunkConfiguration("Chunk index exceeded 64-bit limits".to_string())
        })?;
    }

    // 6. Flush Writer
    writer.flush().map_err(|e| {
        AppError::OutputWriteFailed(format!("Failed to flush output stream: {}", e))
    })?;

    Ok((total_bytes_read, total_output_bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::format::DEFAULT_CHUNK_SIZE;
    use std::io::Cursor;
    use tempfile::NamedTempFile;

    #[test]
    fn test_single_chunk_encryption_roundtrip() {
        let key = DerivedKey::new([0x42u8; 32]);
        let nonce = [0x07u8; 24];
        let aad = b"test-aad-context";
        let plaintext = b"Hello, Aegis authenticated streaming file encryption!";

        let ciphertext = encrypt_chunk(&key, &nonce, aad, plaintext).expect("Encryption failed");
        assert_ne!(&ciphertext, plaintext);
        assert_eq!(ciphertext.len(), plaintext.len() + POLY1305_TAG_LENGTH);

        let decrypted = decrypt_chunk_for_test(&key, &nonce, aad, &ciphertext).expect("Decryption failed");
        assert_eq!(&decrypted, plaintext);
    }

    #[test]
    fn test_chunk_tampering_causes_authentication_failure() {
        let key = DerivedKey::new([0x42u8; 32]);
        let nonce = [0x07u8; 24];
        let aad = b"test-aad-context";
        let plaintext = b"Critical security payload";

        let mut ciphertext = encrypt_chunk(&key, &nonce, aad, plaintext).unwrap();

        // Alter 1 byte of ciphertext
        let last_idx = ciphertext.len() - 1;
        ciphertext[last_idx] ^= 0x01;

        assert!(decrypt_chunk_for_test(&key, &nonce, aad, &ciphertext).is_err());
    }

    #[test]
    fn test_aad_mismatch_causes_authentication_failure() {
        let key = DerivedKey::new([0x42u8; 32]);
        let nonce = [0x07u8; 24];
        let aad1 = b"aad-correct";
        let aad2 = b"aad-tampered";
        let plaintext = b"Critical security payload";

        let ciphertext = encrypt_chunk(&key, &nonce, aad1, plaintext).unwrap();
        assert!(decrypt_chunk_for_test(&key, &nonce, aad2, &ciphertext).is_err());
    }

    #[test]
    fn test_empty_file_streaming_encryption() {
        let input_temp = NamedTempFile::new().unwrap();
        let output_temp = NamedTempFile::new().unwrap();

        let key = DerivedKey::new([0x11u8; 32]);
        let salt = Salt::generate().unwrap();
        let params = Argon2ParamsConfig::default();

        let (in_bytes, out_bytes) = encrypt_file_stream(
            input_temp.path(),
            output_temp.path(),
            &key,
            salt,
            params,
            DEFAULT_CHUNK_SIZE,
            None,
            None,
        )
        .expect("Empty file encryption should succeed");

        assert_eq!(in_bytes, 0);
        assert!(out_bytes > 50); // Header + 1 empty authenticated chunk
    }
}
