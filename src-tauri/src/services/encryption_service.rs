use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use log::{error, info};

use crate::crypto::{
    derive_key_argon2id, encrypt_file_stream, Argon2ParamsConfig, CancellationCheck,
    DEFAULT_CHUNK_SIZE, EncryptionProgressCallback, Salt,
};
use crate::errors::AppError;
use crate::models::{EncryptionRequest, EncryptionResult, OutputConflictStatus};
use crate::services::file_service::FileService;
use crate::utils::paths::generate_encrypted_output_path;
use crate::utils::temp::{cleanup_temp_file_path, prepare_temp_output_path};

pub struct EncryptionService {
    file_service: FileService,
}

impl EncryptionService {
    pub fn new() -> Self {
        Self {
            file_service: FileService::new(),
        }
    }

    /// Encrypts a single file using streaming XChaCha20-Poly1305 and Argon2id.
    ///
    /// The entire operation:
    /// 1. Validates input and output parameters.
    /// 2. Derives an internal 256-bit encryption key with Argon2id and a random salt.
    /// 3. Streams encrypted chunks to an isolated temporary file.
    /// 4. Atomically moves the temporary file to the final output destination.
    /// 5. Automatically cleans up temporary files on any failure.
    pub fn encrypt_file(
        &self,
        request: EncryptionRequest,
        progress_callback: Option<EncryptionProgressCallback>,
        is_cancelled: Option<CancellationCheck>,
    ) -> Result<EncryptionResult, AppError> {
        let start_time = Instant::now();
        info!("Initiating file encryption for input path: {}", request.input_path);

        // 1. Validate Password
        if request.password.is_empty() {
            return Err(AppError::PasswordRequired(
                "Password cannot be empty for encryption".to_string(),
            ));
        }

        // 2. Validate Source File
        let input_path = Path::new(&request.input_path);
        let input_metadata = self.file_service.get_file_metadata(&request.input_path)?;
        let original_size = input_metadata.size_bytes;

        // 3. Determine Final Output Path
        let final_output_path: PathBuf = if let Some(ref out_p) = request.output_path {
            PathBuf::from(out_p)
        } else {
            let out_dir_path = request.output_dir.as_ref().map(|d| Path::new(d.as_str()));
            generate_encrypted_output_path(input_path, out_dir_path, None)
        };

        let output_path_str = final_output_path.to_string_lossy().to_string();

        // 4. Validate Output Conflicts
        let conflict = self.file_service.check_output_conflict(&request.input_path, &output_path_str)?;
        match conflict.status {
            OutputConflictStatus::SameAsInput => {
                return Err(AppError::OutputConflict(
                    "Output path cannot be identical to the source file".to_string(),
                ));
            }
            OutputConflictStatus::ParentDirectoryMissing => {
                return Err(AppError::InvalidOutputDirectory(
                    "Destination directory does not exist".to_string(),
                ));
            }
            OutputConflictStatus::InvalidOutput => {
                return Err(AppError::InvalidPath("Invalid destination path specified".to_string()));
            }
            OutputConflictStatus::OutputExists => {
                if request.overwrite != Some(true) {
                    return Err(AppError::OutputConflict(format!(
                        "Destination file already exists: {}",
                        output_path_str
                    )));
                }
                info!("Destination file exists but overwrite is enabled: {}", output_path_str);
            }
            OutputConflictStatus::NoConflict => {}
        }

        // 5. Prepare Temporary Output Path
        let temp_res = prepare_temp_output_path(&final_output_path)?;
        let temp_path = PathBuf::from(&temp_res.temp_path);
        info!("Created temporary output path: {}", temp_res.temp_path);

        // 6. Generate Cryptographic Salt & Derive Key
        let salt = Salt::generate()?;
        let argon2_params = Argon2ParamsConfig::default();

        info!("Deriving 256-bit key using Argon2id (64MB memory, 3 iterations, 4 threads)...");
        let derived_key = derive_key_argon2id(&request.password, &salt, &argon2_params)?;

        // CRITICAL: request.password is dropped from scope here and not referenced again.

        // 7. Stream and Encrypt to Temporary Output File
        info!("Streaming file encryption to temporary target...");
        let stream_result = encrypt_file_stream(
            input_path,
            &temp_path,
            &derived_key,
            salt,
            argon2_params,
            DEFAULT_CHUNK_SIZE,
            progress_callback,
            is_cancelled,
        );

        // Handle Stream Result and Cleanup on Error
        let (_bytes_read, encrypted_size) = match stream_result {
            Ok(res) => res,
            Err(err) => {
                error!("Streaming encryption encountered error, cleaning temporary file: {:?}", err);
                let _ = cleanup_temp_file_path(&temp_path);
                return Err(err);
            }
        };

        // 8. Safely Finalize & Move Temporary File to Final Destination
        info!("Finalizing output: moving temporary file to destination: {}", output_path_str);
        if let Err(e) = Self::atomic_finalize_file(&temp_path, &final_output_path) {
            let _ = cleanup_temp_file_path(&temp_path);
            return Err(AppError::FinalizationFailed(format!(
                "Failed to finalize output file {}: {}",
                output_path_str, e
            )));
        }

        let duration_ms = start_time.elapsed().as_millis() as u64;
        let output_name = final_output_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("encrypted.enc")
            .to_string();

        info!(
            "Encryption completed successfully for {} -> {} in {}ms ({} bytes -> {} bytes)",
            input_metadata.name, output_name, duration_ms, original_size, encrypted_size
        );

        Ok(EncryptionResult {
            input_path: request.input_path,
            output_path: output_path_str,
            output_name,
            original_size,
            encrypted_size,
            algorithm: "XChaCha20-Poly1305".to_string(),
            key_derivation: "Argon2id".to_string(),
            duration_ms,
            status: "completed".to_string(),
        })
    }

    /// Atomically moves or renames the temporary output file to the final destination.
    /// Falls back to a buffered copy and removal if operating across different filesystem mounts.
    fn atomic_finalize_file(temp_path: &Path, final_path: &Path) -> std::io::Result<()> {
        if let Err(_rename_err) = fs::rename(temp_path, final_path) {
            // Fallback for cross-filesystem / mount moves
            fs::copy(temp_path, final_path)?;
            let _ = fs::remove_file(temp_path);
        }
        Ok(())
    }
}

impl Default for EncryptionService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use tempfile::NamedTempFile;
    use crate::crypto::format::EncryptedFileHeader;
    use crate::crypto::encryption::{decrypt_chunk_for_test, build_chunk_aad};
    use crate::crypto::derive_key_argon2id;

    #[test]
    fn test_full_file_encryption_workflow() {
        let service = EncryptionService::new();

        // Create sample test file
        let mut source_temp = NamedTempFile::new().unwrap();
        let payload = b"Aegis Phase 4 verified authenticated encryption streaming payload";
        source_temp.write_all(payload).unwrap();
        source_temp.flush().unwrap();

        let source_path = source_temp.path().to_str().unwrap().to_string();
        let output_temp = NamedTempFile::new().unwrap();
        let output_path = output_temp.path().to_str().unwrap().to_string();

        let req = EncryptionRequest {
            input_path: source_path.clone(),
            output_path: Some(output_path.clone()),
            output_dir: None,
            password: "SecureTestPassword123!".to_string(),
            overwrite: Some(true),
        };

        let result = service.encrypt_file(req, None, None).expect("Encryption failed");

        assert_eq!(result.original_size, payload.len() as u64);
        assert!(result.encrypted_size > payload.len() as u64);
        assert_eq!(result.status, "completed");

        // Verify that the output file exists and can be parsed and authenticated
        let mut enc_file = fs::File::open(&output_path).unwrap();
        let header = EncryptedFileHeader::read_from(&mut enc_file).expect("Failed to read header");

        // Derive key using password and salt from header
        let key = derive_key_argon2id("SecureTestPassword123!", &header.salt, &header.argon2_params)
            .expect("Key derivation");

        // Read chunk 1
        let mut chunk_len_buf = [0u8; 4];
        enc_file.read_exact(&mut chunk_len_buf).unwrap();
        let chunk_len = u32::from_be_bytes(chunk_len_buf) as usize;

        let mut flag_buf = [0u8; 1];
        enc_file.read_exact(&mut flag_buf).unwrap();
        let is_last = flag_buf[0] == 1;

        let mut ciphertext = vec![0u8; chunk_len];
        enc_file.read_exact(&mut ciphertext).unwrap();

        let chunk_nonce = header.base_nonce.derive_chunk_nonce(1);
        let chunk_aad = build_chunk_aad(1, is_last);

        let decrypted = decrypt_chunk_for_test(&key, &chunk_nonce, &chunk_aad, &ciphertext)
            .expect("Decryption verification failed");

        // Byte-for-byte exact equality test
        assert_eq!(decrypted, payload);
    }

    #[test]
    fn test_encryption_empty_password_rejection() {
        let service = EncryptionService::new();
        let source_temp = NamedTempFile::new().unwrap();

        let req = EncryptionRequest {
            input_path: source_temp.path().to_str().unwrap().to_string(),
            output_path: None,
            output_dir: None,
            password: "".to_string(),
            overwrite: None,
        };

        let res = service.encrypt_file(req, None, None);
        assert!(res.is_err());
    }

    #[test]
    fn test_encryption_missing_file_rejection() {
        let service = EncryptionService::new();

        let req = EncryptionRequest {
            input_path: "/non_existent_folder_123/missing.txt".to_string(),
            output_path: None,
            output_dir: None,
            password: "ValidPassword123!".to_string(),
            overwrite: None,
        };

        let res = service.encrypt_file(req, None, None);
        assert!(res.is_err());
    }
}
