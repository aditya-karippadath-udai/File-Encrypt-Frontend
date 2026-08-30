import { isTauri } from '../platform/environment';
import { FileService } from './fileService';
import { MockFileService } from './mockFileService';
import { TauriFileService } from './tauriFileService';

let fileServiceInstance: FileService | null = null;

export function getFileService(): FileService {
  if (!fileServiceInstance) {
    if (isTauri()) {
      fileServiceInstance = new TauriFileService();
    } else {
      fileServiceInstance = new MockFileService();
    }
  }
  return fileServiceInstance;
}

export const fileService = getFileService();

export * from './fileService';
export * from './mockFileService';
export * from './tauriFileService';
