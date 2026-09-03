use log::info;
use tauri::State;

use crate::models::OperationSummary;
use crate::operations::OperationManager;

#[tauri::command]
pub fn get_session_operations(
    operation_manager: State<'_, OperationManager>,
) -> Result<Vec<OperationSummary>, String> {
    info!("Command invoke: get_session_operations");
    Ok(operation_manager.get_session_operations())
}

#[tauri::command]
pub fn get_session_operation(
    operation_id: String,
    operation_manager: State<'_, OperationManager>,
) -> Result<Option<OperationSummary>, String> {
    info!("Command invoke: get_session_operation (id: {})", operation_id);
    Ok(operation_manager.get_session_operation(&operation_id))
}

#[tauri::command]
pub fn clear_session_operations(
    operation_manager: State<'_, OperationManager>,
) -> Result<(), String> {
    info!("Command invoke: clear_session_operations");
    operation_manager.clear_session_operations();
    Ok(())
}
