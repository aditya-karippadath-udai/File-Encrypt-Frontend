import { EncryptionOperation, ProcessingProgress, ProcessingResult } from '../../types';

export type ProgressCallback = (progress: ProcessingProgress) => void;

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
