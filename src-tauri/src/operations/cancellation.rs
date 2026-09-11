use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};

/// Thread-safe cancellation token registry.
/// Supports both batch-level and job-specific cancellation tokens.
#[derive(Clone, Default)]
pub struct CancellationRegistry {
    // operation_id -> token
    operation_tokens: Arc<RwLock<HashMap<String, Arc<AtomicBool>>>>,
    // (operation_id, job_id) -> token
    job_tokens: Arc<RwLock<HashMap<(String, String), Arc<AtomicBool>>>>,
}

impl CancellationRegistry {
    pub fn new() -> Self {
        Self {
            operation_tokens: Arc::new(RwLock::new(HashMap::new())),
            job_tokens: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Registers a cancellation token for an entire operation.
    pub fn register_operation(&self, operation_id: &str) -> Arc<AtomicBool> {
        let token = Arc::new(AtomicBool::new(false));
        if let Ok(mut map) = self.operation_tokens.write() {
            map.insert(operation_id.to_string(), token.clone());
        }
        token
    }

    /// Registers a cancellation token for an individual job within an operation.
    pub fn register_job(&self, operation_id: &str, job_id: &str) -> Arc<AtomicBool> {
        let token = Arc::new(AtomicBool::new(false));
        if let Ok(mut map) = self.job_tokens.write() {
            map.insert((operation_id.to_string(), job_id.to_string()), token.clone());
        }
        token
    }

    /// Cancels an entire operation and signals all child jobs to terminate immediately.
    pub fn cancel_operation(&self, operation_id: &str) -> bool {
        let mut cancelled_any = false;

        if let Ok(map) = self.operation_tokens.read() {
            if let Some(token) = map.get(operation_id) {
                token.store(true, Ordering::SeqCst);
                cancelled_any = true;
            }
        }

        // Also signal all active job tokens belonging to this operation
        if let Ok(map) = self.job_tokens.read() {
            for ((op_id, _), token) in map.iter() {
                if op_id == operation_id {
                    token.store(true, Ordering::SeqCst);
                    cancelled_any = true;
                }
            }
        }

        cancelled_any
    }

    /// Signals cancellation to all active operations and jobs across the system (used during clean shutdown).
    pub fn cancel_all(&self) {
        if let Ok(map) = self.operation_tokens.read() {
            for token in map.values() {
                token.store(true, Ordering::SeqCst);
            }
        }
        if let Ok(map) = self.job_tokens.read() {
            for token in map.values() {
                token.store(true, Ordering::SeqCst);
            }
        }
    }

    /// Cancels an individual job within an operation without terminating the entire batch.
    pub fn cancel_job(&self, operation_id: &str, job_id: &str) -> bool {
        if let Ok(map) = self.job_tokens.read() {
            if let Some(token) = map.get(&(operation_id.to_string(), job_id.to_string())) {
                token.store(true, Ordering::SeqCst);
                return true;
            }
        }
        false
    }

    /// Checks if a job or its parent operation has been cancelled.
    pub fn is_cancelled(&self, operation_id: &str, job_id: Option<&str>) -> bool {
        // Check operation-level cancellation first
        if let Ok(map) = self.operation_tokens.read() {
            if let Some(token) = map.get(operation_id) {
                if token.load(Ordering::SeqCst) {
                    return true;
                }
            }
        }

        // If job_id is provided, check job-level cancellation
        if let Some(jid) = job_id {
            if let Ok(map) = self.job_tokens.read() {
                if let Some(token) = map.get(&(operation_id.to_string(), jid.to_string())) {
                    if token.load(Ordering::SeqCst) {
                        return true;
                    }
                }
            }
        }

        false
    }

    /// Removes all tokens associated with a completed or cancelled operation.
    pub fn cleanup_operation(&self, operation_id: &str) {
        if let Ok(mut map) = self.operation_tokens.write() {
            map.remove(operation_id);
        }

        if let Ok(mut map) = self.job_tokens.write() {
            map.retain(|(op_id, _), _| op_id != operation_id);
        }
    }

    /// Removes an individual job token.
    pub fn cleanup_job(&self, operation_id: &str, job_id: &str) {
        if let Ok(mut map) = self.job_tokens.write() {
            map.remove(&(operation_id.to_string(), job_id.to_string()));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cancellation_job_and_batch_isolation() {
        let registry = CancellationRegistry::new();
        let op_token = registry.register_operation("op-1");
        let job1_token = registry.register_job("op-1", "job-1");
        let job2_token = registry.register_job("op-1", "job-2");

        assert!(!registry.is_cancelled("op-1", Some("job-1")));
        assert!(!registry.is_cancelled("op-1", Some("job-2")));

        // Cancel only job-1
        assert!(registry.cancel_job("op-1", "job-1"));
        assert!(job1_token.load(Ordering::SeqCst));
        assert!(!job2_token.load(Ordering::SeqCst));
        assert!(!op_token.load(Ordering::SeqCst));

        assert!(registry.is_cancelled("op-1", Some("job-1")));
        assert!(!registry.is_cancelled("op-1", Some("job-2")));

        // Cancel entire operation
        assert!(registry.cancel_operation("op-1"));
        assert!(op_token.load(Ordering::SeqCst));
        assert!(job2_token.load(Ordering::SeqCst));

        assert!(registry.is_cancelled("op-1", Some("job-2")));
    }
}
