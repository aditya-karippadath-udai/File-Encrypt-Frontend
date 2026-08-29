import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../../types';
import { AppInfo, DesktopService, DesktopServiceError, FileDialogOptions, HealthStatus } from './desktopService';
import { mockDesktopService } from './mockDesktopService';

/**
 * Tauri desktop implementation of DesktopService.
 * Direct bridge to Rust Tauri commands via typed invoke() calls.
 */
export class TauriDesktopService implements DesktopService {
  /**
   * Calls the Rust command `get_app_info`
   */
  public async getAppInfo(): Promise<AppInfo> {
    try {
      const response = await invoke<AppInfo>('get_app_info');
      return response;
    } catch (err: unknown) {
      throw this.normalizeError(err, 'Failed to fetch application info from Tauri engine.');
    }
  }

  /**
   * Calls the Rust command `health_check`
   */
  public async healthCheck(): Promise<HealthStatus> {
    try {
      const response = await invoke<HealthStatus>('health_check');
      return response;
    } catch (err: unknown) {
      throw this.normalizeError(err, 'Health check failed on Tauri engine.');
    }
  }

  /**
   * Prompts user for file selection (delegates to browser-safe file picker for Phase 1)
   */
  public async selectFiles(options?: FileDialogOptions): Promise<FileItem[]> {
    return mockDesktopService.selectFiles(options);
  }

  /**
   * Directory picker (delegates to browser-safe picker for Phase 1)
   */
  public async selectDirectory(): Promise<string | null> {
    return mockDesktopService.selectDirectory();
  }

  /**
   * Reveal in file explorer
   */
  public async revealInExplorer(path: string): Promise<void> {
    return mockDesktopService.revealInExplorer(path);
  }

  /**
   * Default output path
   */
  public getDefaultOutputPath(): string {
    return mockDesktopService.getDefaultOutputPath();
  }

  /**
   * Clipboard write
   */
  public async copyToClipboard(text: string): Promise<boolean> {
    return mockDesktopService.copyToClipboard(text);
  }

  /**
   * Download / save file
   */
  public downloadFile(blobOrBuffer: Blob | ArrayBuffer, filename: string): void {
    mockDesktopService.downloadFile(blobOrBuffer, filename);
  }

  /**
   * Formats raw errors into structured DesktopServiceError
   */
  private normalizeError(err: unknown, defaultMessage: string): DesktopServiceError {
    if (typeof err === 'object' && err !== null && 'code' in err && 'message' in err) {
      const typedErr = err as { code: string; message: string; details?: string };
      return {
        code: typedErr.code,
        message: typedErr.message,
        details: typedErr.details,
      };
    }

    if (err instanceof Error) {
      return {
        code: 'INTERNAL_ERROR',
        message: err.message,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: typeof err === 'string' ? err : defaultMessage,
    };
  }
}

export const tauriDesktopService = new TauriDesktopService();
