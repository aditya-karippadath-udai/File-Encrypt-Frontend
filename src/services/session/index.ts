import { isTauri } from '../platform/environment';
import {
  MockSessionOperationService,
  SessionOperationService,
  TauriSessionOperationService,
} from './sessionService';

let serviceInstance: SessionOperationService | null = null;

export function getSessionOperationService(): SessionOperationService {
  if (!serviceInstance) {
    if (isTauri()) {
      serviceInstance = new TauriSessionOperationService();
    } else {
      serviceInstance = new MockSessionOperationService();
    }
  }
  return serviceInstance;
}

export * from './sessionService';
