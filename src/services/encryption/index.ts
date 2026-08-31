import { isTauri } from '../platform/environment';
import { EncryptionService } from './encryptionService';
import { MockEncryptionService } from './mockEncryptionService';
import { TauriEncryptionService } from './tauriEncryptionService';

let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Returns the singleton encryption service instance based on the current environment.
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    if (isTauri()) {
      encryptionServiceInstance = new TauriEncryptionService();
    } else {
      encryptionServiceInstance = new MockEncryptionService();
    }
  }
  return encryptionServiceInstance;
}

export const encryptionService = getEncryptionService();

export * from './encryptionService';
export * from './mockEncryptionService';
export * from './tauriEncryptionService';
