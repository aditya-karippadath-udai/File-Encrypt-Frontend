pub mod commands;
pub mod errors;
pub mod models;
pub mod services;
pub mod state;

use log::info;
use services::SystemService;
use state::AppState;

pub fn run() {
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    info!("Starting Aegis File Encryption Tool (Tauri Engine)...");

    let app_state = AppState::default();
    let system_service = SystemService::new();

    tauri::Builder::default()
        .manage(app_state)
        .manage(system_service)
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::health_check,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
