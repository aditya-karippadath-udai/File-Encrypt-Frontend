import { isTauri } from '../platform/environment';
import {
  MockRecoveryService,
  RecoveryService,
  TauriRecoveryService,
} from './recoveryService';

let serviceInstance: RecoveryService | null = null;

export function getRecoveryService(): RecoveryService {
  if (!serviceInstance) {
    if (isTauri()) {
      serviceInstance = new TauriRecoveryService();
    } else {
      serviceInstance = new MockRecoveryService();
    }
  }
  return serviceInstance;
}

export * from './recoveryService';
