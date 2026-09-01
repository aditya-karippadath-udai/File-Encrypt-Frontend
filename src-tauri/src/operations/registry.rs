use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::errors::AppError;
use crate::models::{EncryptionJob, EncryptionOperation, OperationStatus};

/// Thread-safe in-memory registry for tracking active and completed batch operations.
#[derive(Clone, Default)]
pub struct OperationRegistry {
    operations: Arc<RwLock<HashMap<String, EncryptionOperation>>>,
}

impl OperationRegistry {
    pub fn new() -> Self {
        Self {
            operations: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Stores a new operation.
    pub fn insert_operation(&self, op: EncryptionOperation) {
        if let Ok(mut map) = self.operations.write() {
            map.insert(op.operation_id.clone(), op);
        }
    }

    /// Retrieves a cloned snapshot of an operation.
    pub fn get_operation(&self, operation_id: &str) -> Option<EncryptionOperation> {
        let map = self.operations.read().ok()?;
        map.get(operation_id).cloned()
    }

    /// Safely updates an individual job within an operation using a closure and recalculates totals.
    pub fn update_job<F>(&self, operation_id: &str, job_id: &str, update_fn: F) -> Option<EncryptionJob>
    where
        F: FnOnce(&mut EncryptionJob),
    {
        let mut map = self.operations.write().ok()?;
        let op = map.get_mut(operation_id)?;

        let mut updated_job = None;
        for job in &mut op.jobs {
            if job.job_id == job_id {
                update_fn(job);
                updated_job = Some(job.clone());
                break;
            }
        }

        if updated_job.is_some() {
            op.recalculate_totals();
        }

        updated_job
    }

    /// Transitions an operation's top-level status.
    pub fn update_operation_status(
        &self,
        operation_id: &str,
        new_status: OperationStatus,
    ) -> Result<(), AppError> {
        let mut map = self.operations.write().map_err(|_| {
            AppError::InternalError("Failed to acquire write lock on operation registry".to_string())
        })?;

        let op = map.get_mut(operation_id).ok_or_else(|| {
            AppError::OperationNotFound(format!("Operation {} not found in registry", operation_id))
        })?;

        op.status.transition_to(new_status)?;
        Ok(())
    }

    /// Recalculates totals and terminal status for an operation and returns the updated snapshot.
    pub fn recalculate_operation(&self, operation_id: &str) -> Option<EncryptionOperation> {
        let mut map = self.operations.write().ok()?;
        let op = map.get_mut(operation_id)?;
        op.recalculate_totals();
        Some(op.clone())
    }

    /// Removes an operation from the registry.
    pub fn remove_operation(&self, operation_id: &str) {
        if let Ok(mut map) = self.operations.write() {
            map.remove(operation_id);
        }
    }

    /// Returns snapshots of all operations.
    pub fn get_all_operations(&self) -> Vec<EncryptionOperation> {
        if let Ok(map) = self.operations.read() {
            map.values().cloned().collect()
        } else {
            Vec::new()
        }
    }
}
