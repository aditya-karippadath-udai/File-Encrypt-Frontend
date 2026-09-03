export type OperationType = 'encrypt' | 'decrypt';

export type FileStatus = 'waiting' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'skipped';

export type BatchOperationStatus =
  | 'created'
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'completed_with_errors'
  | 'cancelled'
  | 'failed';

export type BatchJobStatus =
  | 'queued'
  | 'preparing'
  | 'encrypting'
  | 'decrypting'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelling'
  | 'cancelled'
  | 'skipped';

export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  lastModified: number;
  isEncrypted: boolean;
  rawFile?: File;
  validationStatus?: 'ready' | 'invalid' | 'duplicate';
  validationError?: string;
  extension?: string;
}

export interface ProcessingProgress {
  percent: number;
  bytesProcessed: number;
  totalBytes: number;
  speedBytesPerSec: number;
  timeRemainingSec: number;
  stageText: string;
}

export interface BatchEncryptionJob {
  job_id: string;
  operation_id: string;
  input_path: string;
  output_path?: string;
  output_name?: string;
  status: BatchJobStatus;
  total_bytes: number;
  processed_bytes: number;
  progress_percentage: number;
  stage: string;
  error?: string;
  duration_ms?: number;
  created_at: string;
  completed_at?: string;
}

export interface BatchEncryptionOperation {
  operation_id: string;
  status: BatchOperationStatus;
  total_files: number;
  completed_files: number;
  failed_files: number;
  cancelled_files: number;
  skipped_files?: number;
  total_bytes: number;
  processed_bytes: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  jobs: BatchEncryptionJob[];
}

export interface BatchProgressPayload {
  operation_id: string;
  total_files: number;
  completed_files: number;
  failed_files: number;
  cancelled_files: number;
  skipped_files?: number;
  total_bytes: number;
  processed_bytes: number;
  percentage: number;
  status: BatchOperationStatus;
}

export interface JobProgressPayload {
  operation_id: string;
  job_id: string;
  input_path: string;
  bytes_processed: number;
  total_bytes: number;
  percentage: number;
  stage: string;
  status: BatchJobStatus;
  output_path?: string;
  error?: string;
}

export interface JobResultItem {
  job_id: string;
  input_path: string;
  output_path?: string;
  output_name?: string;
  status: BatchJobStatus;
  original_size: number;
  encrypted_size: number;
  duration_ms: number;
  error?: string;
}

export interface BatchOperationResult {
  operation_id: string;
  status: BatchOperationStatus;
  total_files: number;
  successful_files: number;
  failed_files: number;
  cancelled_files: number;
  skipped_files?: number;
  total_bytes: number;
  processed_bytes: number;
  duration_ms: number;
  started_at: string;
  completed_at: string;
  jobs: JobResultItem[];
}

export interface StartBatchRequest {
  input_files: string[];
  output_directory?: string;
  password: string;
  concurrency?: number;
  overwrite?: boolean;
  rawFiles?: File[];
  conflict_plan?: BatchConflictPlan;
}

export interface EncryptionOperation {
  id: string;
  file: FileItem;
  type: OperationType;
  status: FileStatus;
  progress: ProcessingProgress;
  password?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
  outputPath?: string;
  outputName?: string;
  checksum?: string;
  algorithm?: string;
  keyDerivation?: string;
}

export interface ProcessingResult {
  operationId: string;
  success: boolean;
  error?: string;
  outputPath: string;
  outputName: string;
  checksum: string;
  durationMs: number;
}

export interface EncryptedFileDetectionResult {
  is_encrypted: boolean;
  format_version?: number;
  algorithm?: string;
  key_derivation?: string;
  chunk_size_bytes?: number;
  salt_hex?: string;
  nonce_hex?: string;
  error?: string;
}

// ----------------------------------------------------
// Phase 7: Conflict Resolution Types
// ----------------------------------------------------

export type OutputConflictStrategy = 'ask' | 'skip' | 'rename' | 'overwrite' | 'cancel';

export type ConflictAction = 'skip' | 'rename' | 'overwrite';

export type ConflictType =
  | 'none'
  | 'file_exists'
  | 'same_as_input'
  | 'parent_missing'
  | 'invalid_path'
  | 'internal_collision';

export interface PlannedOutputItem {
  job_id: string;
  input_path: string;
  input_filename: string;
  proposed_output_path: string;
  proposed_output_name: string;
  conflict_type: ConflictType;
  can_overwrite: boolean;
  chosen_action: ConflictAction;
  resolved_output_path: string;
  resolved_output_name: string;
  conflict_message?: string;
}

export interface ConflictSummary {
  total_files: number;
  conflicting_files: number;
  safe_files: number;
  same_as_input_files: number;
}

export interface BatchConflictPlan {
  global_strategy: OutputConflictStrategy;
  items: PlannedOutputItem[];
  has_conflicts: boolean;
  has_fatal_errors: boolean;
  summary: ConflictSummary;
}

// ----------------------------------------------------
// Phase 7: Stale Temporary File Recovery Types
// ----------------------------------------------------

export interface StaleTempFile {
  path: string;
  filename: string;
  parent_directory: string;
  size_bytes: number;
  created_at?: string;
  modified_at?: string;
  age_secs: number;
}

export interface StaleCleanupResult {
  cleaned_count: number;
  cleaned_bytes: number;
  failed_paths: string[];
}

// ----------------------------------------------------
// Phase 7: Session Summary & Non-Persistent History
// ----------------------------------------------------

export interface JobSummary {
  job_id: string;
  input_path: string;
  input_filename: string;
  output_path?: string;
  output_filename?: string;
  status: BatchJobStatus;
  duration_ms: number;
  bytes_processed: number;
  total_bytes: number;
  safe_error?: string;
  is_skipped: boolean;
}

export interface OperationSummary {
  operation_id: string;
  operation_type: OperationType;
  status: BatchOperationStatus;
  started_at: string;
  completed_at?: string;
  duration_ms: number;
  total_files: number;
  completed_files: number;
  failed_files: number;
  cancelled_files: number;
  skipped_files: number;
  total_bytes: number;
  processed_bytes: number;
  jobs: JobSummary[];
}

export type ThemeMode = 'dark' | 'light' | 'system';
export type OutputBehavior = 'same-folder' | 'custom-folder' | 'ask';

export interface AppSettings {
  theme: ThemeMode;
  outputBehavior: OutputBehavior;
  defaultConflictStrategy: OutputConflictStrategy;
  customOutputPath: string;
  preserveOriginal: boolean;
  overwriteProtection: boolean;
  autoClearQueue: boolean;
  autoClearDelaySec: number;
  concurrency: number;
  chunkSizeMb: number;
  algorithm: string;
  keyDerivation: string;
}

export interface HistoryItem {
  id: string;
  fileName: string;
  originalSize: number;
  outputSize: number;
  operation: OperationType;
  status: 'completed' | 'failed' | 'cancelled' | 'skipped';
  timestamp: number;
  durationMs: number;
  outputPath: string;
  checksum: string;
  algorithm: string;
  error?: string;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastNotification {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export type ActiveTab = 'dashboard' | 'encrypt' | 'decrypt' | 'queue' | 'history' | 'session' | 'settings';
