import { DesktopService, FileDialogOptions } from './desktopService';
import { FileItem } from '../../types';
import { generateId } from '../../utils/formatters';

const DEMO_FILES_SAMPLE: Omit<FileItem, 'id'>[] = [
  {
    name: 'financial-report-2026.pdf',
    size: 14.8 * 1024 * 1024,
    type: 'application/pdf',
    path: '~/Documents/Financial/financial-report-2026.pdf',
    lastModified: Date.now() - 3600000 * 4,
    isEncrypted: false,
  },
  {
    name: 'database-backup.sql',
    size: 840 * 1024 * 1024,
    type: 'application/sql',
    path: '~/Backups/Database/database-backup.sql',
    lastModified: Date.now() - 3600000 * 24,
    isEncrypted: false,
  },
  {
    name: 'project-source-archive.zip',
    size: 215 * 1024 * 1024,
    type: 'application/zip',
    path: '~/Development/project-source-archive.zip',
    lastModified: Date.now() - 3600000 * 2,
    isEncrypted: false,
  },
  {
    name: 'confidential-records.enc',
    size: 48.2 * 1024 * 1024,
    type: 'application/octet-stream',
    path: '~/Vaults/confidential-records.enc',
    lastModified: Date.now() - 3600000 * 12,
    isEncrypted: true,
  },
  {
    name: 'client-contracts-2026.enc',
    size: 112 * 1024 * 1024,
    type: 'application/octet-stream',
    path: '~/Vaults/client-contracts-2026.enc',
    lastModified: Date.now() - 3600000 * 48,
    isEncrypted: true,
  },
  {
    name: 'presentation-board-deck.pptx',
    size: 32.6 * 1024 * 1024,
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    path: '~/Documents/Presentations/presentation-board-deck.pptx',
    lastModified: Date.now() - 3600000 * 6,
    isEncrypted: false,
  },
];

export class MockDesktopService implements DesktopService {
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
          const isEncrypted = file.name.endsWith('.enc') || file.name.endsWith('.aegis') || file.name.endsWith('.vault');
          return {
            id: generateId('file'),
            name: file.name,
            size: file.size,
            type: file.type || (isEncrypted ? 'application/octet-stream' : 'application/octet-stream'),
            path: `~/Documents/${file.name}`,
            lastModified: file.lastModified || Date.now(),
            isEncrypted,
            rawFile: file,
          };
        });

        resolve(files);
      };

      // Fallback if user cancels browser dialog
      window.addEventListener(
        'focus',
        () => {
          setTimeout(() => {
            if (!input.files || input.files.length === 0) {
              // Dialog was likely closed without selection
            }
          }, 500);
        },
        { once: true }
      );

      input.click();
    });
  }

  public async selectDirectory(): Promise<string | null> {
    // Simulated directory selection in browser
    const paths = ['~/Documents/EncryptedVault', '~/SecureStorage/AegisOutput', '~/Desktop/SecuredFiles', '~/Backups/Encrypted'];
    const chosen = paths[Math.floor(Math.random() * paths.length)];
    return chosen;
  }

  public async revealInExplorer(_path: string): Promise<void> {
    // In future Tauri: invoke('reveal_in_explorer', { path })
    return Promise.resolve();
  }

  public getDefaultOutputPath(): string {
    return '~/Documents/Aegis-Encrypted';
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

  /**
   * Helper to fetch realistic demo files for quick app testing
   */
  public getSampleDemoFiles(encryptedOnly?: boolean): FileItem[] {
    const list = encryptedOnly
      ? DEMO_FILES_SAMPLE.filter((f) => f.isEncrypted)
      : DEMO_FILES_SAMPLE.filter((f) => !f.isEncrypted);

    return list.map((item) => ({
      ...item,
      id: generateId('demo_file'),
    }));
  }
}

export const desktopService = new MockDesktopService();
