import { FileItem } from '../../types';
import { generateId } from '../../utils/formatters';

export interface FileDialogOptions {
  multiple?: boolean;
  encryptedOnly?: boolean;
  title?: string;
}

export interface DesktopService {
  selectFiles(options?: FileDialogOptions): Promise<FileItem[]>;
  selectDirectory(): Promise<string | null>;
  revealInExplorer(path: string): Promise<void>;
  getDefaultOutputPath(): string;
  copyToClipboard(text: string): Promise<boolean>;
  downloadFile(blobOrBuffer: Blob | ArrayBuffer, filename: string): void;
}

export class RealDesktopService implements DesktopService {
  public async selectFiles(options?: FileDialogOptions): Promise<FileItem[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options?.multiple ?? true;
      if (options?.encryptedOnly) {
        input.accept = '.enc,.aegis,.vault';
      }

      input.onchange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (!target.files || target.files.length === 0) {
          resolve([]);
          return;
        }

        const files: FileItem[] = Array.from(target.files).map((file) => {
          const isEncrypted =
            file.name.endsWith('.enc') ||
            file.name.endsWith('.aegis') ||
            file.name.endsWith('.vault');

          return {
            id: generateId('file'),
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            path: file.name,
            lastModified: file.lastModified || Date.now(),
            isEncrypted,
            rawFile: file,
          };
        });

        resolve(files);
      };

      // In case user dismisses file dialog
      const handleWindowFocus = () => {
        setTimeout(() => {
          if (!input.files || input.files.length === 0) {
            resolve([]);
          }
        }, 1000);
      };
      window.addEventListener('focus', handleWindowFocus, { once: true });

      input.click();
    });
  }

  public async selectDirectory(): Promise<string | null> {
    if ('showDirectoryPicker' in window) {
      try {
        const picker = (window as unknown as { showDirectoryPicker: () => Promise<{ name: string }> }).showDirectoryPicker;
        const dirHandle = await picker();
        return `/${dirHandle.name}`;
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
          return null;
        }
      }
    }
    return '~/Downloads';
  }

  public async revealInExplorer(_path: string): Promise<void> {
    return Promise.resolve();
  }

  public getDefaultOutputPath(): string {
    return '~/Downloads';
  }

  public async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public downloadFile(blobOrBuffer: Blob | ArrayBuffer, filename: string): void {
    const blob =
      blobOrBuffer instanceof Blob
        ? blobOrBuffer
        : new Blob([blobOrBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

export const desktopService = new RealDesktopService();
