import { isTauri } from '../platform/environment';
import { DecryptionService } from './decryptionService';
import { mockDecryptionService } from './mockDecryptionService';
import { tauriDecryptionService } from './tauriDecryptionService';

export const decryptionService: DecryptionService = isTauri()
  ? tauriDecryptionService
  : mockDecryptionService;

export * from './decryptionService';
export * from './decryptionEvents';
export { tauriDecryptionService } from './tauriDecryptionService';
export { mockDecryptionService } from './mockDecryptionService';
