import { StaleCleanupResult, StaleTempFile } from '../../types';

function getTauriInvoke(): ((cmd: string, args?: Record<string, unknown>) => Promise<any>) | null {
  if (typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
    return (window as any).__TAURI__.core.invoke;
  }
  return null;
}

export interface RecoveryService {
  detectStaleTempFiles(directories: string[], maxAgeSecs?: number): Promise<StaleTempFile[]>;
  cleanupStaleTempFiles(filePaths: string[]): Promise<StaleCleanupResult>;
}

export class TauriRecoveryService implements RecoveryService {
  private invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const invokeFn = getTauriInvoke();
    if (!invokeFn) {
      return Promise.reject(new Error(`Tauri invoke is not available: ${cmd}`));
    }
    return invokeFn(cmd, args);
  }

  async detectStaleTempFiles(directories: string[], maxAgeSecs?: number): Promise<StaleTempFile[]> {
    return this.invoke<StaleTempFile[]>('detect_stale_temp_files', {
      directories,
      maxAgeSecs: maxAgeSecs ?? 300,
    });
  }

  async cleanupStaleTempFiles(filePaths: string[]): Promise<StaleCleanupResult> {
    return this.invoke<StaleCleanupResult>('cleanup_stale_temp_files', {
      filePaths,
    });
  }
}

export class MockRecoveryService implements RecoveryService {
  private mockStaleFiles: StaleTempFile[] = [];

  constructor() {
    // Empty by default for clean session
    this.mockStaleFiles = [];
  }

  async detectStaleTempFiles(_directories: string[], _maxAgeSecs?: number): Promise<StaleTempFile[]> {
    return [...this.mockStaleFiles];
  }

  async cleanupStaleTempFiles(filePaths: string[]): Promise<StaleCleanupResult> {
    const initialCount = this.mockStaleFiles.length;
    this.mockStaleFiles = this.mockStaleFiles.filter((f) => !filePaths.includes(f.path));
    const cleanedCount = initialCount - this.mockStaleFiles.length;

    return {
      cleaned_count: cleanedCount,
      cleaned_bytes: cleanedCount * 1024 * 1024,
      failed_paths: [],
    };
  }
}
