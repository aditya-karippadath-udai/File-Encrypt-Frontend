import { create } from 'zustand';
import { getRecoveryService } from '../services/recovery';
import { StaleTempFile } from '../types';
import { useToastStore } from './useToastStore';

interface RecoveryState {
  staleFiles: StaleTempFile[];
  isScanning: boolean;
  isCleaning: boolean;
  hasScanned: boolean;
  bannerDismissed: boolean;

  scanForStaleFiles: (directories?: string[]) => Promise<StaleTempFile[]>;
  cleanupAllStaleFiles: () => Promise<void>;
  dismissBanner: () => void;
}

export const useRecoveryStore = create<RecoveryState>((set, get) => ({
  staleFiles: [],
  isScanning: false,
  isCleaning: false,
  hasScanned: false,
  bannerDismissed: false,

  scanForStaleFiles: async (directories = ['.']) => {
    set({ isScanning: true });
    try {
      const recoveryService = getRecoveryService();
      const files = await recoveryService.detectStaleTempFiles(directories);
      set({
        staleFiles: files,
        isScanning: false,
        hasScanned: true,
      });
      return files;
    } catch {
      set({ isScanning: false, hasScanned: true });
      return [];
    }
  },

  cleanupAllStaleFiles: async () => {
    const { staleFiles } = get();
    if (staleFiles.length === 0) return;

    set({ isCleaning: true });
    const addToast = useToastStore.getState().addToast;

    try {
      const recoveryService = getRecoveryService();
      const paths = staleFiles.map((f) => f.path);
      const res = await recoveryService.cleanupStaleTempFiles(paths);

      set({
        staleFiles: [],
        isCleaning: false,
        bannerDismissed: true,
      });

      addToast({
        type: 'success',
        title: 'Recovery cleanup complete',
        message: `Removed ${res.cleaned_count} orphaned temporary file${res.cleaned_count === 1 ? '' : 's'}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cleanup failed';
      set({ isCleaning: false });
      addToast({
        type: 'error',
        title: 'Cleanup error',
        message: msg,
      });
    }
  },

  dismissBanner: () => {
    set({ bannerDismissed: true });
  },
}));
