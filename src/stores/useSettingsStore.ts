import { create } from 'zustand';
import { AppSettings, OutputBehavior, ThemeMode } from '../types';

interface SettingsState {
  settings: AppSettings;
  setTheme: (theme: ThemeMode) => void;
  setOutputBehavior: (behavior: OutputBehavior) => void;
  setCustomOutputPath: (path: string) => void;
  setPreserveOriginal: (preserve: boolean) => void;
  setOverwriteProtection: (protect: boolean) => void;
  setAutoClearQueue: (autoClear: boolean) => void;
  setAutoClearDelaySec: (delay: number) => void;
  setConcurrency: (concurrency: number) => void;
  setChunkSizeMb: (size: number) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  outputBehavior: 'same-folder',
  customOutputPath: '~/Documents/Aegis-Encrypted',
  preserveOriginal: true,
  overwriteProtection: true,
  autoClearQueue: false,
  autoClearDelaySec: 10,
  concurrency: 2,
  chunkSizeMb: 4,
  algorithm: 'XChaCha20-Poly1305 (256-bit AEAD)',
  keyDerivation: 'Argon2id (64MB RAM, 4 Iterations)',
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,

  setTheme: (theme) => {
    set((state) => {
      const root = document.documentElement;
      if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      return { settings: { ...state.settings, theme } };
    });
  },

  setOutputBehavior: (outputBehavior) =>
    set((state) => ({ settings: { ...state.settings, outputBehavior } })),

  setCustomOutputPath: (customOutputPath) =>
    set((state) => ({ settings: { ...state.settings, customOutputPath } })),

  setPreserveOriginal: (preserveOriginal) =>
    set((state) => ({ settings: { ...state.settings, preserveOriginal } })),

  setOverwriteProtection: (overwriteProtection) =>
    set((state) => ({ settings: { ...state.settings, overwriteProtection } })),

  setAutoClearQueue: (autoClearQueue) =>
    set((state) => ({ settings: { ...state.settings, autoClearQueue } })),

  setAutoClearDelaySec: (autoClearDelaySec) =>
    set((state) => ({ settings: { ...state.settings, autoClearDelaySec } })),

  setConcurrency: (concurrency) =>
    set((state) => ({ settings: { ...state.settings, concurrency } })),

  setChunkSizeMb: (chunkSizeMb) =>
    set((state) => ({ settings: { ...state.settings, chunkSizeMb } })),

  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
}));
