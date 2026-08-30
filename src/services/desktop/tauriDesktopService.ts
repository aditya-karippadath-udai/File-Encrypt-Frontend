import { invoke } from '@tauri-apps/api/core';
import { FileItem } from '../../types';
import { AppInfo, DesktopService, DesktopServiceError, FileDialogOptions, HealthStatus } from './desktopService';
import { mockDesktopService } from './mockDesktopService';
import { FileMetadata } from '../files/fileService';

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
   * Prompts user for file selection via native file picker dialog
   */
  public async selectFiles(options?: FileDialogOptions): Promise<FileItem[]> {
    try {
      const metaList = await invoke<FileMetadata[]>('select_files', { options });
      if (!metaList || metaList.length === 0) {
        return [];
      }

      return metaList.map((meta) => ({
        id: `native-file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: meta.name,
        size: meta.sizeBytes,
        type: meta.extension ? `file/${meta.extension}` : 'application/octet-stream',
        path: meta.path,
        lastModified: meta.modifiedAt ? new Date(meta.modifiedAt).getTime() : Date.now(),
        isEncrypted: meta.isEncrypted,
        validationStatus: 'ready',
      }));
    } catch (err: unknown) {
      console.warn('Native select_files invoke failed, falling back to mock file picker', err);
      return mockDesktopService.selectFiles(options);
    }
  }

  /**
   * Native directory picker dialog
   */
  public async selectDirectory(): Promise<string | null> {
    try {
      return await invoke<string | null>('select_output_directory');
    } catch (err: unknown) {
      console.warn('Native select_output_directory invoke failed, falling back to mock folder picker', err);
      return mockDesktopService.selectDirectory();
    }
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
