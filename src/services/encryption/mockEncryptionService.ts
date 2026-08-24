import { EncryptionOperation, ProcessingProgress, ProcessingResult } from '../../types';
import { EncryptionService, ProgressCallback } from './encryptionService';

export class MockEncryptionService implements EncryptionService {
  private pausedOperations = new Set<string>();
  private cancelledOperations = new Set<string>();

  public pauseOperation(operationId: string): void {
    this.pausedOperations.add(operationId);
  }

  public resumeOperation(operationId: string): void {
    this.pausedOperations.delete(operationId);
  }

  public cancelOperation(operationId: string): void {
    this.cancelledOperations.add(operationId);
    this.pausedOperations.delete(operationId);
  }

  public isPaused(operationId: string): boolean {
    return this.pausedOperations.has(operationId);
  }

  public async encryptFile(
    operation: EncryptionOperation,
    onProgress: ProgressCallback,
    signal?: AbortSignal
  ): Promise<ProcessingResult> {
    return this.simulateOperation(operation, 'encrypt', onProgress, signal);
  }

  public async decryptFile(
    operation: EncryptionOperation,
    onProgress: ProgressCallback,
    signal?: AbortSignal
  ): Promise<ProcessingResult> {
    // Check for simulated failure trigger (e.g., password == "wrong" or password == "fail" or starts with "bad")
    if (operation.password && (operation.password.toLowerCase() === 'wrong' || operation.password.toLowerCase() === 'fail')) {
      // Simulate quick attempt then error
      await new Promise((r) => setTimeout(r, 600));
      throw new Error('Authentication tag mismatch: Invalid password or corrupted ciphertext header.');
    }

    return this.simulateOperation(operation, 'decrypt', onProgress, signal);
  }

  private async simulateOperation(
    operation: EncryptionOperation,
    type: 'encrypt' | 'decrypt',
    onProgress: ProgressCallback,
    signal?: AbortSignal
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const totalBytes = operation.file.size || 10 * 1024 * 1024;
    this.cancelledOperations.delete(operation.id);
    this.pausedOperations.delete(operation.id);

    // Simulated target speed: 35 MB/s to 75 MB/s (in bytes per sec)
    const baseSpeed = (38 + Math.random() * 32) * 1024 * 1024;
    // Total simulated steps
    const totalSteps = 24;
    // Target simulation duration: scale based on file size, min 1.4s, max 7.5s for smooth UX
    const totalDurationMs = Math.max(1400, Math.min(7500, Math.round((totalBytes / (1024 * 1024)) * 70) + 1200));
    const stepInterval = totalDurationMs / totalSteps;

    // Stage 1: Key Derivation (Argon2id)
    onProgress({
      percent: 3,
      bytesProcessed: 0,
      totalBytes,
      speedBytesPerSec: 0,
      timeRemainingSec: Math.round(totalDurationMs / 1000),
      stageText: 'Deriving key with Argon2id (64MB memory, 4 iterations)...',
    });
    await this.delay(350, operation.id, signal);

    // Stage 2: Processing chunks
    let currentProcessed = 0;
    for (let step = 1; step <= totalSteps; step++) {
      // Check cancellation
      if (this.cancelledOperations.has(operation.id) || signal?.aborted) {
        throw new Error('Operation was cancelled by user');
      }

      // Check pause
      while (this.pausedOperations.has(operation.id)) {
        if (this.cancelledOperations.has(operation.id) || signal?.aborted) {
          throw new Error('Operation was cancelled by user');
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const fraction = step / totalSteps;
      currentProcessed = Math.min(totalBytes, Math.round(fraction * totalBytes));
      const percent = Math.min(96, Math.round(fraction * 96));
      
      const jitterSpeed = baseSpeed * (0.85 + Math.random() * 0.3);
      const remainingBytes = Math.max(0, totalBytes - currentProcessed);
      const timeRemainingSec = jitterSpeed > 0 ? Math.max(1, Math.round(remainingBytes / jitterSpeed)) : 0;

      const stage =
        type === 'encrypt'
          ? fraction < 0.8
            ? `Encrypting blocks (XChaCha20-Poly1305)...`
            : `Generating Poly1305 authentication MAC...`
          : fraction < 0.8
            ? `Decrypting ciphertext stream...`
            : `Verifying integrity checksum & payload...`;

      onProgress({
        percent,
        bytesProcessed: currentProcessed,
        totalBytes,
        speedBytesPerSec: jitterSpeed,
        timeRemainingSec: percent > 90 ? 1 : timeRemainingSec,
        stageText: stage,
      });

      await this.delay(stepInterval, operation.id, signal);
    }

    // Stage 3: Finalizing output
    onProgress({
      percent: 100,
      bytesProcessed: totalBytes,
      totalBytes,
      speedBytesPerSec: baseSpeed,
      timeRemainingSec: 0,
      stageText: 'Writing verified output file...',
    });
    await this.delay(200, operation.id, signal);

    const durationMs = Date.now() - startTime;
    const isEnc = type === 'encrypt';

    let outputName = operation.file.name;
    if (isEnc) {
      outputName = operation.file.name.endsWith('.enc') ? operation.file.name : `${operation.file.name}.enc`;
    } else {
      outputName = operation.file.name.endsWith('.enc')
        ? operation.file.name.slice(0, -4)
        : `decrypted_${operation.file.name}`;
    }

    const outputPath = `~/Documents/AegisOutput/${outputName}`;
    const fakeChecksum = this.generateSimulatedHash();

    return {
      operationId: operation.id,
      success: true,
      outputPath,
      outputName,
      checksum: fakeChecksum,
      durationMs,
    };
  }

  private async delay(ms: number, operationId: string, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(), ms);
      
      const checkAbort = () => {
        clearTimeout(timer);
        reject(new Error('Operation was cancelled'));
      };

      if (signal) {
        signal.addEventListener('abort', checkAbort, { once: true });
      }

      if (this.cancelledOperations.has(operationId)) {
        clearTimeout(timer);
        reject(new Error('Operation was cancelled'));
      }
    });
  }

  private generateSimulatedHash(): string {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }
}

export const encryptionService = new MockEncryptionService();
