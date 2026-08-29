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

const STORAGE_KEY = 'aegis_user_settings_v1';

export function applyTheme(theme: ThemeMode) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
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

const getInitialSettings = (): AppSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // Fallback to default
  }
  return DEFAULT_SETTINGS;
};

const initialSettings = getInitialSettings();
// Apply theme immediately on initial load
applyTheme(initialSettings.theme);

// System preference change listener
if (typeof window !== 'undefined') {
  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      const current = useSettingsStore.getState().settings.theme;
      if (current === 'system') {
        applyTheme('system');
      }
    });
  } catch {
    // Ignore mediaQuery error if not supported
  }
}

const saveSettings = (settings: AppSettings) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage quota or disabled
  }
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: initialSettings,

  setTheme: (theme) => {
    applyTheme(theme);
    set((state) => {
      const newSettings = { ...state.settings, theme };
      saveSettings(newSettings);
      return { settings: newSettings };
    });
  },

  setOutputBehavior: (outputBehavior) =>
    set((state) => {
      const newSettings = { ...state.settings, outputBehavior };
      saveSettings(newSettings);
      return { settings: newSettings };
    }),

  setCustomOutputPath: (customOutputPath) =>
    set((state) => {
      const newSettings = { ...state.settings, customOutputPath };
      saveSettings(newSettings);
      return { settings: newSettings };
    }),

  setPreserveOriginal: (preserveOriginal) =>
    set((state) => {
      const newSettings = { ...state.settings, preserveOriginal };
      saveSettings(newSettings);
      return { settings: newSettings };
    }),

  setOverwriteProtection: (overwriteProtection) =>
    set((state) => {
      const newSettings = { ...state.settings, overwriteProtection };
      saveSettings(newSettings);
      return { settings: newSettings };
    }),

  setAutoClearQueue: (autoClearQueue) =>
    set((state) => {
      const newSettings = { ...state.settings, autoClearQueue };
      saveSettings(newSettings);
      return { settings: newSettings };
    }),

  setAutoClearDelaySec: (autoClearDelaySec) =>
    set((state) => {
      const newSettings = { ...state.settings, autoClearDelaySec };
      saveSettings(newSettings);
      return { settings: newSettings };
    }),

  setConcurrency: (concurrency) =>
    set((state) => {
      const newSettings = { ...state.settings, concurrency };
      saveSettings(newSettings);
      return { settings: newSettings };
    }),

  setChunkSizeMb: (chunkSizeMb) =>
    set((state) => {
      const newSettings = { ...state.settings, chunkSizeMb };
      saveSettings(newSettings);
      return { settings: newSettings };
    }),

  resetSettings: () => {
    applyTheme(DEFAULT_SETTINGS.theme);
    saveSettings(DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
  },
}));

