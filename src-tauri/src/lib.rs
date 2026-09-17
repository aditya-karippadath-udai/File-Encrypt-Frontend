pub mod commands;
pub mod crypto;
pub mod errors;
pub mod models;
pub mod operations;
pub mod services;
pub mod state;
pub mod utils;

use log::info;
use operations::OperationManager;
use services::{
    DecryptionService, EncryptionService, FileService, RecoveryService, SecurityService,
    SystemService,
};
use state::AppState;
use tauri::Manager;

pub fn run() {
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    info!("Starting Aegis File Encryption Tool (Tauri Engine)...");

    let app_state = AppState::default();
    let system_service = SystemService::new();
    let file_service = FileService::new();
    let recovery_service = RecoveryService::new();
    let security_service = SecurityService::new();
    let encryption_service = EncryptionService::new();
    let decryption_service = DecryptionService::new();
    let operation_manager = OperationManager::new();

    tauri::Builder::default()
        .manage(app_state)
        .manage(system_service)
        .manage(file_service)
        .manage(recovery_service)
        .manage(security_service)
        .manage(encryption_service)
        .manage(decryption_service)
        .manage(operation_manager)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                info!(
                    "Window '{}' close requested. Performing clean shutdown and exiting application...",
                    window.label()
                );
                if let Some(op_manager) = window.try_state::<OperationManager>() {
                    op_manager.cancel_all();
                }
                // Completely terminate the Tauri application process.
                // Ensures no background process, tray icon, or hidden window remains active.
                window.app_handle().exit(0);
            }
        })
        .invoke_handler(tauri::generate_handler![
            // System commands
            commands::get_app_info,
            commands::health_check,
            // File management commands
            commands::select_files,
            commands::resolve_dropped_paths,
            commands::select_output_directory,
            commands::get_file_metadata,
            commands::get_files_metadata,
            commands::validate_file,
            commands::validate_files,
            commands::get_batch_summary,
            commands::validate_output_directory,
            commands::generate_output_path,
            commands::check_output_conflict,
            commands::plan_batch_outputs,
            commands::prepare_temp_output,
            commands::cleanup_temp_file,
            // Recovery commands
            commands::detect_stale_temp_files,
            commands::cleanup_stale_temp_files,
            // Session operations
            commands::get_session_operations,
            commands::get_session_operation,
            commands::clear_session_operations,
            // Security & Key Derivation commands
            commands::validate_password,
            commands::prepare_key_derivation,
            // Encryption commands
            commands::encrypt_file,
            commands::start_encryption_batch,
            commands::cancel_encryption_job,
            commands::cancel_encryption_operation,
            commands::get_encryption_operation_status,
            // Decryption commands
            commands::detect_encrypted_file,
            commands::decrypt_file,
            commands::start_decryption_batch,
            commands::cancel_decryption_job,
            commands::cancel_decryption_operation,
            commands::get_decryption_operation_status,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
