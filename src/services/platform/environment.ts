/**
 * Safe platform & environment detection utilities.
 * Handles both Tauri desktop shell and standard web browser execution
 * without throwing runtime exceptions or accessing undefined globals.
 */

export interface EnvironmentInfo {
  isTauri: boolean;
  platform: 'tauri' | 'browser';
  userAgent: string;
  isSecureContext: boolean;
}

/**
 * Safely checks if the application is running inside a Tauri v2 desktop webview.
 * Evaluates window internals without relying on hardcoded global variables.
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Tauri v2 injects window.__TAURI_INTERNALS__ or window.__TAURI__
  const win = window as unknown as Record<string, unknown>;
  const hasTauriInternals = typeof win.__TAURI_INTERNALS__ !== 'undefined';
  const hasTauriGlobal = typeof win.__TAURI__ !== 'undefined';
  const hasTauriMetadata = typeof win.__TAURI_METADATA__ !== 'undefined';

  return Boolean(hasTauriInternals || hasTauriGlobal || hasTauriMetadata);
}

/**
 * Returns a human-readable platform name.
 */
export function getPlatformName(): 'tauri' | 'browser' {
  return isTauri() ? 'tauri' : 'browser';
}

/**
 * Inspects the current runtime environment.
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  const tauri = isTauri();
  return {
    isTauri: tauri,
    platform: tauri ? 'tauri' : 'browser',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
  };
}
