use chrono::Utc;
use log::info;

use crate::errors::AppError;
use crate::models::{AppInfoResponse, HealthCheckResponse};
use crate::state::AppState;

pub struct SystemService;

impl SystemService {
    pub fn new() -> Self {
        Self
    }

    pub fn get_app_info(&self, state: &AppState) -> Result<AppInfoResponse, AppError> {
        info!("Fetching application info from system service");
        Ok(AppInfoResponse {
            name: state.app_name.clone(),
            version: state.version.clone(),
            backend: "tauri".to_string(),
            status: "ready".to_string(),
        })
    }

    pub fn health_check(&self) -> Result<HealthCheckResponse, AppError> {
        info!("Performing backend health check");
        Ok(HealthCheckResponse {
            status: "healthy".to_string(),
            timestamp: Utc::now().to_rfc3339(),
            backend: "tauri".to_string(),
        })
    }
}

impl Default for SystemService {
    fn default() -> Self {
        Self::new()
    }
}
