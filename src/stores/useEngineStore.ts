import { create } from 'zustand';
import { isTauri } from '../services/platform/environment';
import { AppInfo, BackendConnectionState, desktopService, HealthStatus } from '../services/desktop';

interface EngineState {
  isTauri: boolean;
  connectionState: BackendConnectionState;
  appInfo: AppInfo | null;
  health: HealthStatus | null;
  error: string | null;
  lastChecked: number | null;
  checkHealth: () => Promise<void>;
}

export const useEngineStore = create<EngineState>((set, get) => ({
  isTauri: isTauri(),
  connectionState: isTauri() ? 'connecting' : 'browser',
  appInfo: null,
  health: null,
  error: null,
  lastChecked: null,

  checkHealth: async () => {
    const tauri = isTauri();
    set({ isTauri: tauri });

    if (!tauri) {
      try {
        const info = await desktopService.getAppInfo();
        const health = await desktopService.healthCheck();
        set({
          connectionState: 'browser',
          appInfo: info,
          health,
          error: null,
          lastChecked: Date.now(),
        });
      } catch (err) {
        set({
          connectionState: 'browser',
          error: err instanceof Error ? err.message : 'Browser mock fallback active',
          lastChecked: Date.now(),
        });
      }
      return;
    }

    set({ connectionState: 'connecting', error: null });

    try {
      const [info, health] = await Promise.all([
        desktopService.getAppInfo(),
        desktopService.healthCheck(),
      ]);

      set({
        connectionState: 'connected',
        appInfo: info,
        health,
        error: null,
        lastChecked: Date.now(),
      });
    } catch (err: unknown) {
      const errMsg =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : err instanceof Error
          ? err.message
          : 'Unable to communicate with the desktop service.';

      set({
        connectionState: 'unavailable',
        error: errMsg,
        lastChecked: Date.now(),
      });
    }
  },
}));
