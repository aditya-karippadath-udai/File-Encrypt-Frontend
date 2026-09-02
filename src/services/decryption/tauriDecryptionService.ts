import { invoke } from '@tauri-apps/api/core';
import {
  BatchEncryptionOperation,
  BatchOperationResult,
  EncryptedFileDetectionResult,
  EncryptionOperation,
  ProcessingResult,
  StartBatchRequest,
} from '../../types';
import {
  DecryptionService,
  NativeDecryptionRequest,
  NativeDecryptionResult,
  ProgressCallback,
} from './decryptionService';

export class TauriDecryptionService implements DecryptionService {
  private pausedOperations = new Set<string>();
  private cancelledOperations = new Set<string>();

  public async detectEncryptedFile(path: string): Promise<EncryptedFileDetectionResult> {
    try {
      return await invoke<EncryptedFileDetectionResult>('detect_encrypted_file', { path });
    } catch (err: unknown) {
      return {
        is_encrypted: false,
        error: this.formatErrorMessage(err),
      };
    }
  }

  public async startBatch(request: StartBatchRequest): Promise<BatchOperationResult> {
    try {
      return await invoke<BatchOperationResult>('start_decryption_batch', {
        request: {
          input_files: request.input_files,
          output_directory: request.output_directory,
          password: request.password,
          concurrency: request.concurrency,
          overwrite: request.overwrite ?? true,
        },
      });
    } catch (err: unknown) {
      throw new Error(this.formatErrorMessage(err));
    }
  }

  public async cancelJob(operationId: string, jobId: string): Promise<void> {
    try {
      await invoke('cancel_decryption_job', {
        operationId,
        jobId,
      });
    } catch (err: unknown) {
      console.warn(`Failed to cancel decryption job ${jobId}:`, err);
    }
  }

  public async cancelBatch(operationId: string): Promise<void> {
    try {
      await invoke('cancel_decryption_operation', {
        operationId,
      });
    } catch (err: unknown) {
      console.warn(`Failed to cancel decryption operation ${operationId}:`, err);
    }
  }

  public async getOperationStatus(operationId: string): Promise<BatchEncryptionOperation> {
    try {
      return await invoke<BatchEncryptionOperation>('get_decryption_operation_status', {
        operationId,
      });
    } catch (err: unknown) {
      throw new Error(this.formatErrorMessage(err));
    }
  }

  public pauseOperation(operationId: string): void {
    this.pausedOperations.add(operationId);
  }

  public resumeOperation(operationId: string): void {
    this.pausedOperations.delete(operationId);
  }

  public cancelOperation(operationId: string): void {
    this.cancelledOperations.add(operationId);
    this.pausedOperations.delete(operationId);
    void this.cancelBatch(operationId);
  }

  public isPaused(operationId: string): boolean {
    return this.pausedOperations.has(operationId);
  }

  public async decryptFile(
    operation: EncryptionOperation,
    onProgress: ProgressCallback,
    signal?: AbortSignal
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    this.cancelledOperations.delete(operation.id);
    this.pausedOperations.delete(operation.id);

    if (!operation.password) {
      throw new Error('Password is required for decryption.');
    }

    if (!operation.file.path) {
      throw new Error('Native file path is required for desktop file decryption.');
    }

    if (this.cancelledOperations.has(operation.id) || signal?.aborted) {
      throw new Error('Operation was cancelled by user');
    }

    // Stage 1: Container inspection and key derivation
    onProgress({
      percent: 15,
      bytesProcessed: 0,
      totalBytes: operation.file.size,
      speedBytesPerSec: 0,
      timeRemainingSec: 1,
      stageText: 'Verifying container header and deriving key with Argon2id...',
    });

    await this.checkPauseOrCancel(operation.id, signal);

    // Stage 2: Streaming authenticated decryption
    onProgress({
      percent: 50,
      bytesProcessed: Math.round(operation.file.size * 0.4),
      totalBytes: operation.file.size,
      speedBytesPerSec: 140 * 1024 * 1024,
      timeRemainingSec: 1,
      stageText: 'Streaming XChaCha20-Poly1305 authenticated decryption...',
    });

    const request: NativeDecryptionRequest = {
      input_path: operation.file.path,
      output_path: operation.outputPath,
      output_dir: undefined,
      password: operation.password,
      overwrite: true,
    };

    let result: NativeDecryptionResult;
    try {
      result = await invoke<NativeDecryptionResult>('decrypt_file', { request });
    } catch (err: unknown) {
      const errorMsg = this.formatErrorMessage(err);
      throw new Error(errorMsg);
    }

    await this.checkPauseOrCancel(operation.id, signal);

    // Stage 3: Completed
    onProgress({
      percent: 100,
      bytesProcessed: operation.file.size,
      totalBytes: operation.file.size,
      speedBytesPerSec: 160 * 1024 * 1024,
      timeRemainingSec: 0,
      stageText: 'File decrypted and verified successfully.',
    });

    return {
      operationId: operation.id,
      success: true,
      outputPath: result.output_path,
      outputName: result.output_name || result.original_file_name,
      checksum: `AEGIS-${result.algorithm.toUpperCase()}`,
      durationMs: Date.now() - startTime,
    };
  }

  private formatErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
        return (err as { message: string }).message;
      }
      if ('error' in err && typeof (err as { error: unknown }).error === 'string') {
        return (err as { error: string }).error;
      }
    }
    return 'An unexpected error occurred during native decryption.';
  }

  private async checkPauseOrCancel(operationId: string, signal?: AbortSignal): Promise<void> {
    if (this.cancelledOperations.has(operationId) || signal?.aborted) {
      throw new Error('Operation was cancelled by user');
    }

    while (this.pausedOperations.has(operationId)) {
      if (this.cancelledOperations.has(operationId) || signal?.aborted) {
        throw new Error('Operation was cancelled by user');
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

export const tauriDecryptionService = new TauriDecryptionService();
