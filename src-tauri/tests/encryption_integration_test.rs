use file_encryption_tool_lib::crypto::decryption::decrypt_file_stream;
use file_encryption_tool_lib::crypto::encryption::encrypt_file_stream;
use file_encryption_tool_lib::models::decryption::DecryptionRequest;
use file_encryption_tool_lib::models::encryption::EncryptionRequest;
use file_encryption_tool_lib::services::{DecryptionService, EncryptionService};
use std::fs;
use std::path::PathBuf;

#[test]
fn test_encryption_and_decryption_stream() {
    let temp_dir = std::env::temp_dir().join(format!("aegis_test_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).expect("failed to create temp dir");

    let input_path = temp_dir.join("test_document.txt");
    let encrypted_path = temp_dir.join("test_document.txt.enc");
    let decrypted_path = temp_dir.join("test_document_decrypted.txt");

    let test_content =
        b"The quick brown fox jumps over the lazy dog. Highly sensitive document content.";
    fs::write(&input_path, test_content).expect("failed to write test file");

    let password = "SuperSecretPassword123!";

    // Test direct crypto stream encryption
    let enc_result = encrypt_file_stream(&input_path, &encrypted_path, password, None)
        .expect("encryption failed");

    assert!(encrypted_path.exists());
    assert_eq!(enc_result.bytes_encrypted, test_content.len() as u64);

    // Test direct crypto stream decryption
    let dec_result = decrypt_file_stream(&encrypted_path, &decrypted_path, password, None)
        .expect("decryption failed");

    assert!(decrypted_path.exists());
    assert_eq!(dec_result.bytes_decrypted, test_content.len() as u64);

    let decrypted_content = fs::read(&decrypted_path).expect("failed to read decrypted file");
    assert_eq!(test_content.to_vec(), decrypted_content);

    // Test wrong password decryption failure
    let bad_decrypted_path = temp_dir.join("bad_decrypted.txt");
    let bad_result =
        decrypt_file_stream(&encrypted_path, &bad_decrypted_path, "WrongPassword!", None);
    assert!(bad_result.is_err());

    // Clean up
    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_encryption_service_full_workflow() {
    let temp_dir = std::env::temp_dir().join(format!("aegis_svc_test_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).expect("failed to create temp dir");

    let input_path = temp_dir.join("sample_data.bin");
    let data: Vec<u8> = (0..10000).map(|i| (i % 256) as u8).collect();
    fs::write(&input_path, &data).expect("failed to write binary test file");

    let enc_service = EncryptionService::new();
    let dec_service = DecryptionService::new();

    let password = "AegisStrongPassword2026!";

    // Run encryption service with absolute path
    let req = EncryptionRequest {
        input_path: input_path.to_string_lossy().to_string(),
        output_path: None,
        output_dir: Some(temp_dir.to_string_lossy().to_string()),
        password: password.to_string(),
        overwrite: Some(true),
    };

    let enc_res = enc_service
        .encrypt_file(req, None, None)
        .expect("service encryption failed");
    assert!(PathBuf::from(&enc_res.output_path).exists());

    // Run decryption service
    let dec_req = DecryptionRequest {
        input_path: enc_res.output_path.clone(),
        output_path: None,
        output_dir: Some(temp_dir.to_string_lossy().to_string()),
        password: password.to_string(),
        overwrite: Some(true),
    };

    let dec_res = dec_service
        .decrypt_file(dec_req, None, None)
        .expect("service decryption failed");
    let restored_bytes = fs::read(&dec_res.output_path).expect("failed to read decrypted output");
    assert_eq!(data, restored_bytes);

    // Clean up
    let _ = fs::remove_dir_all(&temp_dir);
}
