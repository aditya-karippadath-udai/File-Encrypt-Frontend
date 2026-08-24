import { FileItem } from '../../types';

export interface FileDialogOptions {
  multiple?: boolean;
  encryptedOnly?: boolean;
  title?: string;
}

export interface DesktopService {
  /**
   * Opens native or simulated file selector dialog
   */
  selectFiles(options?: FileDialogOptions): Promise<FileItem[]>;

  /**
   * Opens native or simulated directory selector dialog
   */
  selectDirectory(): Promise<string | null>;

  /**
   * Reveals a file or folder in OS file explorer (Finder/Windows Explorer/Nautilus)
   */
  revealInExplorer(path: string): Promise<void>;

  /**
   * Gets the system default output folder path
   */
  getDefaultOutputPath(): string;

  /**
   * Copies checksum or string to clipboard
   */
  copyToClipboard(text: string): Promise<boolean>;
}
