import {
  BatchEncryptionOperation,
  BatchOperationResult,
  EncryptedFileDetectionResult,
  EncryptionOperation,
  ProcessingProgress,
  ProcessingResult,
  StartBatchRequest,
} from '../../types';

export type ProgressCallback = (progress: ProcessingProgress) => void;

export interface NativeDecryptionRequest {
  input_path: string;
  output_path?: string;
  output_dir?: string;
  password: string;
  overwrite?: boolean;
}

export interface NativeDecryptionResult {
  input_path: string;
  output_path: string;
  output_name: string;
  original_file_name: string;
  original_size_bytes: number;
  decrypted_size_bytes: number;
  duration_ms: number;
  algorithm: string;
  format_version: number;
}

export interface DecryptionService {
  /**
   * Inspects a file's binary header to determine if it is an authentic Aegis encrypted file.
   */
  detectEncryptedFile(path: string, rawFile?: File): Promise<EncryptedFileDetectionResult>;

  /**
   * Decrypts a single file using authenticated XChaCha20-Poly1305 with progress and cancellation.
   */
  decryptFile(
    operation: EncryptionOperation,
    onProgress: ProgressCallback,
    signal?: AbortSignal
  ): Promise<ProcessingResult>;

  /**
   * Starts a batch decryption operation.
   */
  startBatch(request: StartBatchRequest): Promise<BatchOperationResult>;

  /**
   * Cancels an individual job in an operation.
   */
  cancelJob(operationId: string, jobId: string): Promise<void>;

  /**
   * Cancels an entire batch operation.
   */
  cancelBatch(operationId: string): Promise<void>;

  /**
   * Retrieves the current snapshot and progress metrics of a decryption operation.
   */
  getOperationStatus(operationId: string): Promise<BatchEncryptionOperation>;

  /**
   * Pauses an active operation.
   */
  pauseOperation(operationId: string): void;

  /**
   * Resumes a paused operation.
   */
  resumeOperation(operationId: string): void;

  /**
   * Cancels an active operation locally.
   */
  cancelOperation(operationId: string): void;

  /**
   * Checks if an operation is currently paused.
   */
  isPaused(operationId: string): boolean;
}
