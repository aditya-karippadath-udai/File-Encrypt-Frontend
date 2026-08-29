import { isTauri } from '../platform/environment';
import { DesktopService } from './desktopService';
import { mockDesktopService, MockDesktopService } from './mockDesktopService';
import { tauriDesktopService, TauriDesktopService } from './tauriDesktopService';

export * from './desktopService';
export * from './mockDesktopService';
export * from './tauriDesktopService';

/**
 * Service factory that returns the appropriate DesktopService adapter
 * based on whether the application is running inside Tauri desktop shell
 * or standard browser mode.
 */
export function getDesktopService(): DesktopService {
  if (isTauri()) {
    return tauriDesktopService;
  }
  return mockDesktopService;
}

/**
 * Primary DesktopService singleton instance used throughout the React application.
 */
export const desktopService: DesktopService = getDesktopService();
export default desktopService;
