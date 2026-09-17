use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use log::{error, info};

use crate::crypto::{
    decrypt_file_stream, derive_key_argon2id, detect_encrypted_file,
    recover_authenticated_metadata, CancellationCheck, DecryptionProgressCallback,
    EncryptedFileDetectionResult, EncryptedFileHeader, CURRENT_FORMAT_VERSION,
};
use crate::errors::AppError;
use crate::models::{DecryptionRequest, DecryptionResult, OutputConflictStatus};
use crate::services::file_service::FileService;
use crate::utils::temp::{cleanup_temp_file_path, prepare_temp_output_path};

pub struct DecryptionService {
    file_service: FileService,
}

impl DecryptionService {
    pub fn new() -> Self {
        Self {
            file_service: FileService::new(),
        }
    }

    /// Inspects the header preamble of a candidate encrypted file.
    pub fn detect_encrypted_file(&self, path: &str) -> Result<EncryptedFileDetectionResult, AppError> {
        let input_path = Path::new(path);
        detect_encrypted_file(input_path)
    }

    /// Decrypts a single encrypted container file.
    ///
    /// 1. Validates password and source container.
    /// 2. Reads and parses the authenticated container header.
    /// 3. Derives the 256-bit decryption key using stored Argon2id salt and parameters.
    /// 4. Authenticates and recovers original metadata (original filename, size, extension).
    /// 5. Resolves and validates the destination path against path traversal and overwrites.
    /// 6. Streams decrypted chunks to an isolated temporary file.
    /// 7. Atomically finalizes the output file.
    /// 8. Cleans up temporary output files if any error or cancellation occurs.
    pub fn decrypt_file(
        &self,
        request: DecryptionRequest,
        progress_callback: Option<DecryptionProgressCallback>,
        is_cancelled: Option<CancellationCheck>,
    ) -> Result<DecryptionResult, AppError> {
        let start_time = Instant::now();
        info!("Initiating file decryption for input container: {}", request.input_path);

        // 1. Validate Password
        if request.password.is_empty() {
            return Err(AppError::PasswordRequired(
                "Password cannot be empty for decryption".to_string(),
            ));
        }

        // 2. Validate Source Encrypted File
        let input_path = Path::new(&request.input_path);
        if !input_path.exists() {
            return Err(AppError::FileNotFound(format!(
                "Encrypted source file not found: {}",
                request.input_path
            )));
        }

        let input_metadata = self.file_service.get_file_metadata(&request.input_path)?;
        let encrypted_file_size = input_metadata.size_bytes;

        // 3. Open Container and Parse Header
        let mut enc_file = fs::File::open(input_path).map_err(|e| {
            AppError::FileAccessDenied(format!("Failed to open encrypted file: {}", e))
        })?;

        let header = EncryptedFileHeader::read_from(&mut enc_file)?;

        // Validate format version
        if header.version != CURRENT_FORMAT_VERSION {
            return Err(AppError::UnsupportedFileVersion(format!(
                "Unsupported file version: {} (expected {})",
                header.version, CURRENT_FORMAT_VERSION
            )));
        }

        // 4. Derive Decryption Key using Argon2id
        info!("Deriving 256-bit decryption key via Argon2id from container salt...");
        let derived_key = derive_key_argon2id(&request.password, header.salt.as_bytes(), Some(&header.argon2_params))?;

        // 5. Authenticate and Recover Metadata
        info!("Authenticating and extracting embedded metadata...");
        let original_meta = recover_authenticated_metadata(&header, &derived_key)?;
        let expected_plaintext_size = original_meta.file_size;

        // 6. Determine Final Output Path
        let final_output_path: PathBuf = if let Some(ref out_p) = request.output_path {
            PathBuf::from(out_p)
        } else if let Some(ref out_d) = request.output_dir {
            let mut dir_buf = PathBuf::from(out_d);
            dir_buf.push(&original_meta.file_name);
            dir_buf
        } else {
            // Default: save in same directory as the encrypted input file
            let parent_dir = input_path.parent().unwrap_or_else(|| Path::new("."));
            let mut path_buf = parent_dir.to_path_buf();
            path_buf.push(&original_meta.file_name);
            path_buf
        };

        let output_path_str = final_output_path.to_string_lossy().to_string();

        // 7. Validate Output Conflicts
        let conflict = self.file_service.check_output_conflict(&request.input_path, &output_path_str)?;
        match conflict.status {
            OutputConflictStatus::SameAsInput => {
                return Err(AppError::OutputConflict(
                    "Output path cannot be identical to the encrypted source file".to_string(),
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

        // 8. Prepare Temporary Output Path
        let temp_res = prepare_temp_output_path(&final_output_path)?;
        let temp_path = PathBuf::from(&temp_res.temp_path);
        info!("Created temporary decryption target: {}", temp_res.temp_path);

        // 9. Stream and Decrypt Payload
        info!("Streaming file decryption and payload verification...");
        let stream_result = decrypt_file_stream(
            input_path,
            &temp_path,
            &derived_key,
            &header,
            expected_plaintext_size,
            progress_callback,
            is_cancelled,
        );

        let (_bytes_read, decrypted_size) = match stream_result {
            Ok(res) => res,
            Err(err) => {
                error!("Streaming decryption encountered error, cleaning temporary file: {:?}", err);
                let _ = cleanup_temp_file_path(&temp_path);
                return Err(err);
            }
        };

        // 10. Safely Finalize & Move Temporary File to Output Path
        info!("Finalizing output: moving decrypted temporary file to destination: {}", output_path_str);
        if let Err(e) = Self::atomic_finalize_file(&temp_path, &final_output_path) {
            let _ = cleanup_temp_file_path(&temp_path);
            return Err(AppError::FinalizationFailed(format!(
                "Failed to finalize decrypted file {}: {}",
                output_path_str, e
            )));
        }

        let duration_ms = start_time.elapsed().as_millis() as u64;
        let output_name = final_output_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("decrypted_file")
            .to_string();

        info!(
            "Decryption completed successfully for {} -> {} in {}ms ({} bytes -> {} bytes)",
            input_metadata.name, output_name, duration_ms, encrypted_file_size, decrypted_size
        );

        Ok(DecryptionResult {
            input_path: request.input_path,
            output_path: output_path_str,
            output_name,
            original_size: encrypted_file_size,
            decrypted_size,
            algorithm: "XChaCha20-Poly1305".to_string(),
            key_derivation: "Argon2id".to_string(),
            duration_ms,
            status: "completed".to_string(),
        })
    }

    /// Atomically moves or renames the temporary output file to the final destination.
    fn atomic_finalize_file(temp_path: &Path, final_path: &Path) -> std::io::Result<()> {
        if let Err(_rename_err) = fs::rename(temp_path, final_path) {
            fs::copy(temp_path, final_path)?;
            let _ = fs::remove_file(temp_path);
        }
        Ok(())
    }
}

impl Default for DecryptionService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;
    use crate::crypto::format::CURRENT_FORMAT_VERSION;
    use crate::models::EncryptionRequest;
    use crate::services::encryption_service::EncryptionService;

    #[test]
    fn test_round_trip_encryption_and_decryption_service() {
        let enc_service = EncryptionService::new();
        let dec_service = DecryptionService::new();

        // 1. Create source file
        let mut source_temp = NamedTempFile::new().unwrap();
        let test_payload = b"Production round-trip encryption and decryption verification payload";
        source_temp.write_all(test_payload).unwrap();
        source_temp.flush().unwrap();

        let source_path = source_temp.path().to_str().unwrap().to_string();
        let enc_temp = NamedTempFile::new().unwrap();
        let enc_path = enc_temp.path().to_str().unwrap().to_string();
        let dec_temp = NamedTempFile::new().unwrap();
        let dec_path = dec_temp.path().to_str().unwrap().to_string();

        let password = "UltraSecurePassword999!";

        // 2. Encrypt
        let enc_req = EncryptionRequest {
            input_path: source_path.clone(),
            output_path: Some(enc_path.clone()),
            output_dir: None,
            password: password.to_string(),
            overwrite: Some(true),
        };
        let enc_res = enc_service.encrypt_file(enc_req, None, None).expect("Encryption");
        assert_eq!(enc_res.original_size, test_payload.len() as u64);

        // 3. Detect
        let detect_res = dec_service.detect_encrypted_file(&enc_path).expect("Detection");
        assert!(detect_res.is_encrypted);
        assert_eq!(detect_res.format_version, Some(CURRENT_FORMAT_VERSION));

        // 4. Decrypt with correct password
        let dec_req = DecryptionRequest {
            input_path: enc_path.clone(),
            output_path: Some(dec_path.clone()),
            output_dir: None,
            password: password.to_string(),
            overwrite: Some(true),
        };
        let dec_res = dec_service.decrypt_file(dec_req, None, None).expect("Decryption");
        assert_eq!(dec_res.decrypted_size, test_payload.len() as u64);

        // Verify recovered bytes are identical
        let recovered_bytes = fs::read(&dec_path).unwrap();
        assert_eq!(recovered_bytes, test_payload);

        // 5. Decrypt with wrong password fails
        let dec_wrong_req = DecryptionRequest {
            input_path: enc_path.clone(),
            output_path: Some(dec_path.clone()),
            output_dir: None,
            password: "WrongPassword123!".to_string(),
            overwrite: Some(true),
        };
        let wrong_res = dec_service.decrypt_file(dec_wrong_req, None, None);
        assert!(wrong_res.is_err());
        match wrong_res.unwrap_err() {
            AppError::AuthenticationFailed(_) => {}
            err => panic!("Expected AuthenticationFailed, got {:?}", err),
        }
    }
}
