use log::info;
use tauri::State;

use crate::errors::AppError;
use crate::models::{
    BatchSummary, FileDialogOptions, FileMetadata, FileValidationResult,
    OutputConflictResult, TempFileResult,
};
use crate::services::output_path_service::{BatchConflictPlan, ConflictStrategy};
use crate::services::{FileService, OutputPathService};

#[tauri::command]
pub fn select_files(
    options: Option<FileDialogOptions>,
    file_service: State<'_, FileService>,
) -> Result<Vec<FileMetadata>, AppError> {
    info!("Command invoke: select_files");
    file_service.select_files(options)
}

#[tauri::command]
pub fn resolve_dropped_paths(
    paths: Vec<String>,
    file_service: State<'_, FileService>,
) -> Result<Vec<FileValidationResult>, AppError> {
    info!("Command invoke: resolve_dropped_paths (raw count: {})", paths.len());
    Ok(file_service.resolve_dropped_paths(paths))
}

#[tauri::command]
pub fn select_output_directory(
    file_service: State<'_, FileService>,
) -> Result<Option<String>, AppError> {
    info!("Command invoke: select_output_directory");
    file_service.select_output_directory()
}

#[tauri::command]
pub fn plan_batch_outputs(
    input_paths: Vec<String>,
    output_dir: Option<String>,
    mode: String,
    custom_suffix: Option<String>,
    global_strategy: Option<ConflictStrategy>,
) -> Result<BatchConflictPlan, AppError> {
    info!("Command invoke: plan_batch_outputs (files: {}, mode: {})", input_paths.len(), mode);
    let service = OutputPathService::new();
    service.plan_batch_outputs(
        &input_paths,
        output_dir.as_deref(),
        &mode,
        global_strategy.unwrap_or(ConflictStrategy::Ask),
        custom_suffix.as_deref(),
    )
}

#[tauri::command]
pub fn get_file_metadata(
    path: String,
    file_service: State<'_, FileService>,
) -> Result<FileMetadata, AppError> {
    info!("Command invoke: get_file_metadata for path");
    file_service.get_file_metadata(&path)
}

#[tauri::command]
pub fn get_files_metadata(
    paths: Vec<String>,
    file_service: State<'_, FileService>,
) -> Result<Vec<FileValidationResult>, AppError> {
    info!("Command invoke: get_files_metadata (count: {})", paths.len());
    Ok(file_service.validate_files(paths))
}

#[tauri::command]
pub fn validate_file(
    path: String,
    file_service: State<'_, FileService>,
) -> Result<FileValidationResult, AppError> {
    info!("Command invoke: validate_file");
    Ok(file_service.validate_file(&path))
}

#[tauri::command]
pub fn validate_files(
    paths: Vec<String>,
    file_service: State<'_, FileService>,
) -> Result<Vec<FileValidationResult>, AppError> {
    info!("Command invoke: validate_files (count: {})", paths.len());
    Ok(file_service.validate_files(paths))
}

#[tauri::command]
pub fn get_batch_summary(
    paths: Vec<String>,
    file_service: State<'_, FileService>,
) -> Result<BatchSummary, AppError> {
    info!("Command invoke: get_batch_summary (count: {})", paths.len());
    file_service.get_batch_summary(paths)
}

#[tauri::command]
pub fn validate_output_directory(
    path: String,
    file_service: State<'_, FileService>,
) -> Result<bool, AppError> {
    info!("Command invoke: validate_output_directory");
    file_service.validate_output_directory(&path)
}

#[tauri::command]
pub fn generate_output_path(
    input_path: String,
    output_dir: Option<String>,
    mode: String,
    custom_suffix: Option<String>,
    file_service: State<'_, FileService>,
) -> Result<String, AppError> {
    info!("Command invoke: generate_output_path (mode: {})", mode);
    file_service.generate_output_path(&input_path, output_dir, &mode, custom_suffix)
}

#[tauri::command]
pub fn check_output_conflict(
    input_path: String,
    output_path: String,
    file_service: State<'_, FileService>,
) -> Result<OutputConflictResult, AppError> {
    info!("Command invoke: check_output_conflict");
    file_service.check_output_conflict(&input_path, &output_path)
}

#[tauri::command]
pub fn prepare_temp_output(
    target_path: String,
    file_service: State<'_, FileService>,
) -> Result<TempFileResult, AppError> {
    info!("Command invoke: prepare_temp_output");
    file_service.prepare_temp_output(&target_path)
}

#[tauri::command]
pub fn cleanup_temp_file(
    temp_path: String,
    file_service: State<'_, FileService>,
) -> Result<(), AppError> {
    info!("Command invoke: cleanup_temp_file");
    file_service.cleanup_temp_file(&temp_path)
}
