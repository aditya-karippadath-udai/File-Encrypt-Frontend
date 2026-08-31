import { EncryptionOperation, ProcessingProgress, ProcessingResult } from '../../types';
import { EncryptionService, ProgressCallback } from './encryptionService';
import { desktopService } from '../desktop/desktopService';

const MAGIC_HEADER = new Uint8Array([0x41, 0x45, 0x47, 0x49, 0x53, 0x01]); // "AEGIS\x01"
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;

/**
 * Browser mock implementation of EncryptionService.
 * Uses Web Crypto API in browser preview mode without invoking native Tauri backend commands.
 * CRITICAL: Browser mode does not load gigabyte-scale files into native Rust memory; it operates in simulated client sandbox.
 */
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
    const startTime = Date.now();
    this.cancelledOperations.delete(operation.id);
    this.pausedOperations.delete(operation.id);

    if (!operation.password) {
      throw new Error('Password is required for encryption.');
    }

    const password = operation.password;
    const file = operation.file;

    // Check cancellation
    if (this.cancelledOperations.has(operation.id) || signal?.aborted) {
      throw new Error('Operation was cancelled by user');
    }

    onProgress({
      percent: 5,
      bytesProcessed: 0,
      totalBytes: file.size,
      speedBytesPerSec: 0,
      timeRemainingSec: 1,
      stageText: 'Validating input file buffer (Browser Preview)...',
    });

    let rawBuffer: ArrayBuffer;
    if (file.rawFile) {
      rawBuffer = await file.rawFile.arrayBuffer();
    } else {
      rawBuffer = new ArrayBuffer(0);
    }

    await this.checkPauseOrCancel(operation.id, signal);

    onProgress({
      percent: 25,
      bytesProcessed: 0,
      totalBytes: file.size,
      speedBytesPerSec: 0,
      timeRemainingSec: 1,
      stageText: 'Simulating Argon2id / PBKDF2 256-bit key derivation...',
    });

    // 1. Generate random salt and IV
    const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // 2. Derive key
    const encKey = await this.deriveKey(password, salt);

    await this.checkPauseOrCancel(operation.id, signal);

    onProgress({
      percent: 60,
      bytesProcessed: Math.round(file.size / 2),
      totalBytes: file.size,
      speedBytesPerSec: 45 * 1024 * 1024,
      timeRemainingSec: 1,
      stageText: 'Encrypting chunks with 256-bit AEAD + Poly/GCM tag...',
    });

    // 3. Encrypt payload
    let encryptedContent: ArrayBuffer;
    try {
      encryptedContent = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        encKey,
        rawBuffer
      );
    } catch (err: unknown) {
      throw new Error(`Encryption failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    await this.checkPauseOrCancel(operation.id, signal);

    onProgress({
      percent: 90,
      bytesProcessed: file.size,
      totalBytes: file.size,
      speedBytesPerSec: 60 * 1024 * 1024,
      timeRemainingSec: 1,
      stageText: 'Writing Aegis binary container header...',
    });

    // 4. Construct container: [MAGIC (6 bytes)] + [SALT (16 bytes)] + [IV (12 bytes)] + [FILENAME_LEN (2 bytes)] + [FILENAME (UTF-8)] + [CIPHERTEXT]
    const filenameBytes = new TextEncoder().encode(file.name);
    const filenameLen = filenameBytes.length;
    const headerLen = MAGIC_HEADER.length + SALT_LENGTH + IV_LENGTH + 2 + filenameLen;
    const container = new Uint8Array(headerLen + encryptedContent.byteLength);

    let offset = 0;
    container.set(MAGIC_HEADER, offset);
    offset += MAGIC_HEADER.length;

    container.set(salt, offset);
    offset += SALT_LENGTH;

    container.set(iv, offset);
    offset += IV_LENGTH;

    container[offset] = (filenameLen >> 8) & 0xff;
    container[offset + 1] = filenameLen & 0xff;
    offset += 2;

    container.set(filenameBytes, offset);
    offset += filenameLen;

    container.set(new Uint8Array(encryptedContent), offset);

    // 5. Calculate SHA-256 hash of container
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', container);
    const checksum = this.bufferToHex(hashBuffer);

    const outputName = file.name.endsWith('.enc') ? file.name : `${file.name}.enc`;
    const outputPath = file.path ? `${file.path}.enc` : `~/Downloads/${outputName}`;

    // Trigger local download in browser if raw file is present
    if (file.rawFile) {
      desktopService.downloadFile(container, outputName);
    }

    onProgress({
      percent: 100,
      bytesProcessed: file.size,
      totalBytes: file.size,
      speedBytesPerSec: 50 * 1024 * 1024,
      timeRemainingSec: 0,
      stageText: 'Encrypted file generated and saved.',
    });

    return {
      operationId: operation.id,
      success: true,
      outputPath,
      outputName,
      checksum,
      durationMs: Date.now() - startTime,
    };
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

    let salt: Uint8Array;
    let iv: Uint8Array;
    let originalName = file.name.endsWith('.enc') ? file.name.slice(0, -4) : `decrypted_${file.name}`;
    let ciphertext: Uint8Array;

    let offset = MAGIC_HEADER.length;
    salt = data.slice(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;

    iv = data.slice(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const filenameLen = (data[offset] << 8) | data[offset + 1];
    offset += 2;

    if (filenameLen > 0 && offset + filenameLen <= data.length) {
      originalName = new TextDecoder().decode(data.slice(offset, offset + filenameLen));
      offset += filenameLen;
    }

    ciphertext = data.slice(offset);

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

    // Trigger download of genuine decrypted file
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

export const mockEncryptionService = new MockEncryptionService();
