import { EncryptionOperation, ProcessingProgress, ProcessingResult } from '../../types';

export type ProgressCallback = (progress: ProcessingProgress) => void;

/**
 * Low-level typed request payload sent to the Tauri `encrypt_file` command.
 * CRITICAL: The password exists in memory only for the duration of IPC/key derivation.
 */
export interface NativeEncryptionRequest {
  input_path: string;
  output_path?: string;
  output_dir?: string;
  password: string;
  overwrite?: boolean;
}

/**
 * Low-level typed result returned from the Tauri `encrypt_file` command.
 * CRITICAL: Zero keys, salts, passwords, or raw secrets are returned.
 */
export interface NativeEncryptionResult {
  input_path: string;
  output_path: string;
  output_name: string;
  original_size: number;
  encrypted_size: number;
  algorithm: string;
  key_derivation: string;
  duration_ms: number;
  status: string;
}

/**
 * Core interface for the encryption service layer.
 */
export interface EncryptionService {
  /**
   * Encrypts a single file operation
   */
  encryptFile(
    operation: EncryptionOperation,
    onProgress: ProgressCallback,
    signal?: AbortSignal
  ): Promise<ProcessingResult>;

  /**
   * Decrypts a single file operation
   */
  decryptFile(
    operation: EncryptionOperation,
    onProgress: ProgressCallback,
    signal?: AbortSignal
  ): Promise<ProcessingResult>;

  /**
   * Pauses an active operation
   */
  pauseOperation(operationId: string): void;

  /**
   * Resumes a paused operation
   */
  resumeOperation(operationId: string): void;

  /**
   * Cancels an active or queued operation
   */
  cancelOperation(operationId: string): void;

  /**
   * Checks if an operation is currently paused
   */
  isPaused(operationId: string): boolean;
}
