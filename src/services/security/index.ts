import { isTauri } from '../platform/environment';
import { SecurityService } from './securityService';
import { MockSecurityService } from './mockSecurityService';
import { TauriSecurityService } from './tauriSecurityService';

let securityServiceInstance: SecurityService | null = null;

export function getSecurityService(): SecurityService {
  if (!securityServiceInstance) {
    if (isTauri()) {
      securityServiceInstance = new TauriSecurityService();
    } else {
      securityServiceInstance = new MockSecurityService();
    }
  }
  return securityServiceInstance;
}

export const securityService = getSecurityService();

export * from './securityService';
export * from './mockSecurityService';
export * from './tauriSecurityService';
