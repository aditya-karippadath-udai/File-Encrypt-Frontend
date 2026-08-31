pub mod commands;
pub mod crypto;
pub mod errors;
pub mod models;
pub mod services;
pub mod state;
pub mod utils;

use log::info;
use services::{EncryptionService, FileService, SecurityService, SystemService};
use state::AppState;

pub fn run() {
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    info!("Starting Aegis File Encryption Tool (Tauri Engine)...");

    let app_state = AppState::default();
    let system_service = SystemService::new();
    let file_service = FileService::new();
    let security_service = SecurityService::new();
    let encryption_service = EncryptionService::new();

    tauri::Builder::default()
        .manage(app_state)
        .manage(system_service)
        .manage(file_service)
        .manage(security_service)
        .manage(encryption_service)
        .invoke_handler(tauri::generate_handler![
            // System commands
            commands::get_app_info,
            commands::health_check,
            // File management commands
            commands::select_files,
            commands::select_output_directory,
            commands::get_file_metadata,
            commands::get_files_metadata,
            commands::validate_file,
            commands::validate_files,
            commands::get_batch_summary,
            commands::validate_output_directory,
            commands::generate_output_path,
            commands::check_output_conflict,
            commands::prepare_temp_output,
            commands::cleanup_temp_file,
            // Security & Key Derivation commands
            commands::validate_password,
            commands::prepare_key_derivation,
            // Encryption commands
            commands::encrypt_file,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
