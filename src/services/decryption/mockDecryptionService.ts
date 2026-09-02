import {
  BatchEncryptionJob,
  BatchEncryptionOperation,
  BatchOperationResult,
  BatchOperationStatus,
  EncryptedFileDetectionResult,
  EncryptionOperation,
  JobResultItem,
  ProcessingResult,
  StartBatchRequest,
} from '../../types';
import { desktopService } from '../desktop/desktopService';
import { mockDecryptionEventBus } from './decryptionEvents';
import { DecryptionService, ProgressCallback } from './decryptionService';

const MAGIC_HEADER = new Uint8Array([0x41, 0x45, 0x47, 0x49, 0x53, 0x01]); // "AEGIS\x01"
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;

export class MockDecryptionService implements DecryptionService {
  private pausedOperations = new Set<string>();
  private cancelledOperations = new Set<string>();
  private cancelledJobs = new Set<string>();
  private activeOperations = new Map<string, BatchEncryptionOperation>();

  public async detectEncryptedFile(
    path: string,
    rawFile?: File
  ): Promise<EncryptedFileDetectionResult> {
    if (rawFile) {
      try {
        const slice = await rawFile.slice(0, 64).arrayBuffer();
        const header = new Uint8Array(slice);
        let matches = true;
        for (let i = 0; i < MAGIC_HEADER.length; i++) {
          if (header[i] !== MAGIC_HEADER[i]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return {
            is_encrypted: true,
            format_version: 1,
            algorithm: 'XChaCha20-Poly1305',
            key_derivation: 'Argon2id',
            chunk_size_bytes: 65536,
          };
        }
      } catch {
        // Fallback
      }
    }

    const isEnc = path.toLowerCase().endsWith('.enc');
    return {
      is_encrypted: isEnc,
      format_version: isEnc ? 1 : undefined,
      algorithm: isEnc ? 'XChaCha20-Poly1305' : undefined,
      key_derivation: isEnc ? 'Argon2id' : undefined,
      chunk_size_bytes: isEnc ? 65536 : undefined,
    };
  }

  public async startBatch(request: StartBatchRequest): Promise<BatchOperationResult> {
    const startTime = Date.now();
    const opId = `op-dec-${Math.random().toString(36).substring(2, 10)}`;
    const startedAt = new Date().toISOString();

    this.cancelledOperations.delete(opId);

    const jobs: BatchEncryptionJob[] = request.input_files.map((path, idx) => {
      const filename = path.split('/').pop() || path.split('\\').pop() || `file_${idx + 1}.enc`;
      const rawFile = request.rawFiles?.find((f) => f.name === filename);
      const size = rawFile ? rawFile.size : 1024 * 1024 * (idx + 1) * 2;

      return {
        job_id: `job-${Math.random().toString(36).substring(2, 10)}`,
        operation_id: opId,
        input_path: path,
        status: 'queued',
        total_bytes: size,
        processed_bytes: 0,
        progress_percentage: 0,
        stage: 'Queued',
        created_at: new Date().toISOString(),
      };
    });

    const totalBytes = jobs.reduce((sum, j) => sum + j.total_bytes, 0);

    const operation: BatchEncryptionOperation = {
      operation_id: opId,
      status: 'running',
      total_files: jobs.length,
      completed_files: 0,
      failed_files: 0,
      cancelled_files: 0,
      total_bytes: totalBytes,
      processed_bytes: 0,
      created_at: startedAt,
      started_at: startedAt,
      jobs,
    };

    this.activeOperations.set(opId, operation);

    // Initial event
    mockDecryptionEventBus.emitOperationStatus({
      operation_id: opId,
      total_files: operation.total_files,
      completed_files: 0,
      failed_files: 0,
      cancelled_files: 0,
      total_bytes: totalBytes,
      processed_bytes: 0,
      percentage: 0,
      status: 'running',
    });

    const concurrency = Math.min(Math.max(request.concurrency || 2, 1), 4);
    const queue = [...jobs];
    const jobResults: JobResultItem[] = [];

    const runWorker = async () => {
      while (queue.length > 0) {
        if (this.cancelledOperations.has(opId)) {
          const unstartedJob = queue.shift();
          if (unstartedJob) {
            unstartedJob.status = 'cancelled';
            unstartedJob.stage = 'Cancelled';
            operation.cancelled_files += 1;
            mockDecryptionEventBus.emitJobProgress({
              operation_id: opId,
              job_id: unstartedJob.job_id,
              input_path: unstartedJob.input_path,
              bytes_processed: 0,
              total_bytes: unstartedJob.total_bytes,
              percentage: 0,
              stage: 'Cancelled',
              status: 'cancelled',
            });
            jobResults.push({
              job_id: unstartedJob.job_id,
              input_path: unstartedJob.input_path,
              status: 'cancelled',
              original_size: unstartedJob.total_bytes,
              encrypted_size: 0,
              duration_ms: 0,
            });
          }
          continue;
        }

        const currentJob = queue.shift();
        if (!currentJob) break;

        const jobResult = await this.simulateJobExecution(opId, currentJob, request);
        jobResults.push(jobResult);

        let totalProcessed = 0;
        let completedCount = 0;
        let failedCount = 0;
        let cancelledCount = 0;

        for (const j of operation.jobs) {
          totalProcessed += j.processed_bytes;
          if (j.status === 'completed') completedCount += 1;
          if (j.status === 'failed') failedCount += 1;
          if (j.status === 'cancelled') cancelledCount += 1;
        }

        operation.processed_bytes = totalProcessed;
        operation.completed_files = completedCount;
        operation.failed_files = failedCount;
        operation.cancelled_files = cancelledCount;

        const overallPct =
          operation.total_bytes > 0
            ? Math.min(100, Math.round((totalProcessed / operation.total_bytes) * 100))
            : 100;

        mockDecryptionEventBus.emitBatchProgress({
          operation_id: opId,
          total_files: operation.total_files,
          completed_files: completedCount,
          failed_files: failedCount,
          cancelled_files: cancelledCount,
          total_bytes: operation.total_bytes,
          processed_bytes: totalProcessed,
          percentage: overallPct,
          status: operation.status,
        });
      }
    };

    const workers = Array.from({ length: concurrency }, () => runWorker());
    await Promise.all(workers);

    let finalStatus: BatchOperationStatus = 'completed';
    if (operation.cancelled_files > 0 || operation.failed_files > 0) {
      if (operation.completed_files > 0) {
        finalStatus = 'completed_with_errors';
      } else if (operation.cancelled_files > 0 && operation.failed_files === 0) {
        finalStatus = 'cancelled';
      } else {
        finalStatus = 'failed';
      }
    }
    operation.status = finalStatus;
    const completedAt = new Date().toISOString();
    operation.completed_at = completedAt;

    mockDecryptionEventBus.emitOperationStatus({
      operation_id: opId,
      total_files: operation.total_files,
      completed_files: operation.completed_files,
      failed_files: operation.failed_files,
      cancelled_files: operation.cancelled_files,
      total_bytes: operation.total_bytes,
      processed_bytes: operation.processed_bytes,
      percentage:
        operation.total_bytes > 0
          ? Math.min(100, Math.round((operation.processed_bytes / operation.total_bytes) * 100))
          : 100,
      status: finalStatus,
    });

    return {
      operation_id: opId,
      status: finalStatus,
      total_files: operation.total_files,
      successful_files: operation.completed_files,
      failed_files: operation.failed_files,
      cancelled_files: operation.cancelled_files,
      total_bytes: operation.total_bytes,
      processed_bytes: operation.processed_bytes,
      duration_ms: Date.now() - startTime,
      started_at: startedAt,
      completed_at: completedAt,
      jobs: jobResults,
    };
  }

  private async simulateJobExecution(
    opId: string,
    job: BatchEncryptionJob,
    request: StartBatchRequest
  ): Promise<JobResultItem> {
    const jobStart = Date.now();
    const isJobCancelled = () =>
      this.cancelledOperations.has(opId) || this.cancelledJobs.has(job.job_id);

    if (isJobCancelled()) {
      job.status = 'cancelled';
      job.stage = 'Cancelled';
      mockDecryptionEventBus.emitJobProgress({
        operation_id: opId,
        job_id: job.job_id,
        input_path: job.input_path,
        bytes_processed: 0,
        total_bytes: job.total_bytes,
        percentage: 0,
        stage: 'Cancelled',
        status: 'cancelled',
      });
      return {
        job_id: job.job_id,
        input_path: job.input_path,
        status: 'cancelled',
        original_size: job.total_bytes,
        encrypted_size: 0,
        duration_ms: 0,
      };
    }

    // Stage 1: Preparing
    job.status = 'preparing';
    job.stage = 'Preparing';
    mockDecryptionEventBus.emitJobProgress({
      operation_id: opId,
      job_id: job.job_id,
      input_path: job.input_path,
      bytes_processed: 0,
      total_bytes: job.total_bytes,
      percentage: 5,
      stage: 'Preparing',
      status: 'preparing',
    });
    await new Promise((r) => setTimeout(r, 60));

    // Stage 2: Decrypting
    job.status = 'encrypting';
    job.stage = 'Decrypting';

    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      if (isJobCancelled()) {
        job.status = 'cancelled';
        job.stage = 'Cancelled';
        mockDecryptionEventBus.emitJobProgress({
          operation_id: opId,
          job_id: job.job_id,
          input_path: job.input_path,
          bytes_processed: 0,
          total_bytes: job.total_bytes,
          percentage: 0,
          stage: 'Cancelled',
          status: 'cancelled',
        });
        return {
          job_id: job.job_id,
          input_path: job.input_path,
          status: 'cancelled',
          original_size: job.total_bytes,
          encrypted_size: 0,
          duration_ms: Date.now() - jobStart,
        };
      }

      const processed = Math.round((job.total_bytes * s) / steps);
      const pct = Math.round((processed / job.total_bytes) * 90);
      job.processed_bytes = processed;
      job.progress_percentage = pct;

      mockDecryptionEventBus.emitJobProgress({
        operation_id: opId,
        job_id: job.job_id,
        input_path: job.input_path,
        bytes_processed: processed,
        total_bytes: job.total_bytes,
        percentage: pct,
        stage: 'Decrypting',
        status: 'encrypting',
      });

      await new Promise((r) => setTimeout(r, 80));
    }

    // Stage 3: Finalizing
    job.status = 'finalizing';
    job.stage = 'Finalizing';
    mockDecryptionEventBus.emitJobProgress({
      operation_id: opId,
      job_id: job.job_id,
      input_path: job.input_path,
      bytes_processed: job.total_bytes,
      total_bytes: job.total_bytes,
      percentage: 95,
      stage: 'Finalizing',
      status: 'finalizing',
    });
    await new Promise((r) => setTimeout(r, 40));

    // Stage 4: Completed
    const filename = job.input_path.split('/').pop() || 'file.enc';
    const outputName = filename.endsWith('.enc') ? filename.slice(0, -4) : `decrypted_${filename}`;
    const outDir = request.output_directory || '~/Downloads';
    const outputPath = `${outDir}/${outputName}`;
    const duration = Date.now() - jobStart;

    job.status = 'completed';
    job.stage = 'Completed';
    job.processed_bytes = job.total_bytes;
    job.progress_percentage = 100;
    job.output_path = outputPath;
    job.output_name = outputName;
    job.duration_ms = duration;
    job.completed_at = new Date().toISOString();

    mockDecryptionEventBus.emitJobProgress({
      operation_id: opId,
      job_id: job.job_id,
      input_path: job.input_path,
      bytes_processed: job.total_bytes,
      total_bytes: job.total_bytes,
      percentage: 100,
      stage: 'Completed',
      status: 'completed',
      output_path: outputPath,
    });

    return {
      job_id: job.job_id,
      input_path: job.input_path,
      output_path: outputPath,
      output_name: outputName,
      status: 'completed',
      original_size: job.total_bytes,
      encrypted_size: Math.max(0, job.total_bytes - 256),
      duration_ms: duration,
    };
  }

  public async cancelJob(operationId: string, jobId: string): Promise<void> {
    this.cancelledJobs.add(jobId);
    const op = this.activeOperations.get(operationId);
    if (op) {
      const job = op.jobs.find((j) => j.job_id === jobId);
      if (job && job.status === 'queued') {
        job.status = 'cancelled';
        job.stage = 'Cancelled';
        mockDecryptionEventBus.emitJobProgress({
          operation_id: operationId,
          job_id: jobId,
          input_path: job.input_path,
          bytes_processed: 0,
          total_bytes: job.total_bytes,
          percentage: 0,
          stage: 'Cancelled',
          status: 'cancelled',
        });
      }
    }
  }

  public async cancelBatch(operationId: string): Promise<void> {
    this.cancelledOperations.add(operationId);
    const op = this.activeOperations.get(operationId);
    if (op) {
      for (const job of op.jobs) {
        if (job.status === 'queued') {
          job.status = 'cancelled';
          job.stage = 'Cancelled';
          mockDecryptionEventBus.emitJobProgress({
            operation_id: operationId,
            job_id: job.job_id,
            input_path: job.input_path,
            bytes_processed: 0,
            total_bytes: job.total_bytes,
            percentage: 0,
            stage: 'Cancelled',
            status: 'cancelled',
          });
        }
      }
    }
  }

  public async getOperationStatus(operationId: string): Promise<BatchEncryptionOperation> {
    const op = this.activeOperations.get(operationId);
    if (!op) {
      throw new Error(`Operation ${operationId} not found`);
    }
    return op;
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

    const password = operation.password;
    const file = operation.file;

    if (this.cancelledOperations.has(operation.id) || signal?.aborted) {
      throw new Error('Operation was cancelled by user');
    }

    onProgress({
      percent: 10,
      bytesProcessed: 0,
      totalBytes: file.size,
      speedBytesPerSec: 0,
      timeRemainingSec: 1,
      stageText: 'Reading encrypted container header...',
    });

    let rawBuffer: ArrayBuffer;
    if (file.rawFile) {
      rawBuffer = await file.rawFile.arrayBuffer();
    } else {
      throw new Error('No file data available for browser decryption.');
    }

    const data = new Uint8Array(rawBuffer);

    const minHeaderLen = MAGIC_HEADER.length + SALT_LENGTH + IV_LENGTH + 2;
    if (data.length < minHeaderLen) {
      throw new Error('Invalid file format: Container is corrupted or too small.');
    }

    let offset = MAGIC_HEADER.length;
    const salt = data.slice(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;

    const iv = data.slice(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const filenameLen = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    let originalName = file.name.endsWith('.enc') ? file.name.slice(0, -4) : `decrypted_${file.name}`;
    if (filenameLen > 0 && offset + filenameLen <= data.length) {
      originalName = new TextDecoder().decode(data.slice(offset, offset + filenameLen));
      offset += filenameLen;
    }

    const ciphertext = data.slice(offset);

    await this.checkPauseOrCancel(operation.id, signal);

    onProgress({
      percent: 40,
      bytesProcessed: 0,
      totalBytes: file.size,
      speedBytesPerSec: 0,
      timeRemainingSec: 1,
      stageText: 'Deriving key and authenticating container...',
    });

    const decKey = await this.deriveKey(password, salt);

    await this.checkPauseOrCancel(operation.id, signal);

    onProgress({
      percent: 70,
      bytesProcessed: Math.round(file.size / 2),
      totalBytes: file.size,
      speedBytesPerSec: 50 * 1024 * 1024,
      timeRemainingSec: 1,
      stageText: 'Decrypting authenticated payload stream...',
    });

    let decryptedBuffer: ArrayBuffer;
    try {
      decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        decKey,
        ciphertext
      );
    } catch {
      throw new Error('Authentication tag mismatch: Invalid password or corrupted ciphertext.');
    }

    await this.checkPauseOrCancel(operation.id, signal);

    const hashBuffer = await window.crypto.subtle.digest('SHA-256', decryptedBuffer);
    const checksum = this.bufferToHex(hashBuffer);

    desktopService.downloadFile(decryptedBuffer, originalName);

    const outputPath = `~/Downloads/${originalName}`;

    onProgress({
      percent: 100,
      bytesProcessed: file.size,
      totalBytes: file.size,
      speedBytesPerSec: 55 * 1024 * 1024,
      timeRemainingSec: 0,
      stageText: 'File decrypted and verified successfully.',
    });

    return {
      operationId: operation.id,
      success: true,
      outputPath,
      outputName: originalName,
      checksum,
      durationMs: Date.now() - startTime,
    };
  }

  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private bufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
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

export const mockDecryptionService = new MockDecryptionService();
