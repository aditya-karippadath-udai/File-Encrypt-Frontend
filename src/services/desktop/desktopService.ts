import { FileItem } from '../../types';

export interface AppInfo {
  name: string;
  version: string;
  backend: string;
  status: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  backend: string;
}

export type BackendConnectionState = 'connected' | 'connecting' | 'unavailable' | 'browser';

export interface DesktopServiceError {
  code: string;
  message: string;
  details?: string;
}

export interface FileDialogOptions {
  multiple?: boolean;
  encryptedOnly?: boolean;
  title?: string;
}

export interface DesktopService {
  /**
   * Fetches metadata from the application engine.
   */
  getAppInfo(): Promise<AppInfo>;

  /**
   * Runs a health check against the backend engine.
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Prompts the user to select files from their desktop storage.
   */
  selectFiles(options?: FileDialogOptions): Promise<FileItem[]>;

  /**
   * Prompts the user to select a target output directory.
   */
  selectDirectory(): Promise<string | null>;

  /**
   * Opens the file's containing folder in the desktop file explorer.
   */
  revealInExplorer(path: string): Promise<void>;

  /**
   * Returns the default output path (e.g. ~/Downloads).
   */
  getDefaultOutputPath(): string;

  /**
   * Copies text safely to the clipboard.
   */
  copyToClipboard(text: string): Promise<boolean>;

  /**
   * Triggers a safe file download/save.
   */
  downloadFile(blobOrBuffer: Blob | ArrayBuffer, filename: string): void;
}

export { desktopService, getDesktopService } from './index';
