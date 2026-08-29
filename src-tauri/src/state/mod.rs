use chrono::{DateTime, Utc};

pub struct AppState {
    pub app_name: String,
    pub version: String,
    pub started_at: DateTime<Utc>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            app_name: "File Encryption Tool".to_string(),
            version: "1.0.0".to_string(),
            started_at: Utc::now(),
        }
    }
}
