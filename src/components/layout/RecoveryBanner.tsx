import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw, Trash2, X } from 'lucide-react';
import { useRecoveryStore } from '../../stores/useRecoveryStore';
import { formatBytes } from '../../utils/formatters';

export const RecoveryBanner: React.FC = () => {
  const {
    staleFiles,
    isCleaning,
    hasScanned,
    bannerDismissed,
    scanForStaleFiles,
    cleanupAllStaleFiles,
    dismissBanner,
  } = useRecoveryStore();

  useEffect(() => {
    if (!hasScanned) {
      scanForStaleFiles();
    }
  }, [hasScanned, scanForStaleFiles]);

  if (bannerDismissed || staleFiles.length === 0) {
    return null;
  }

  const totalBytes = staleFiles.reduce((acc, f) => acc + f.size_bytes, 0);

  return (
    <div className="bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2.5 text-xs flex items-center justify-between gap-4 transition-all">
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="truncate">
          <strong>Recovery Notice:</strong> Found {staleFiles.length} orphaned temporary file{staleFiles.length === 1 ? '' : 's'} ({formatBytes(totalBytes)}) from an interrupted previous session.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => cleanupAllStaleFiles()}
          disabled={isCleaning}
          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          {isCleaning ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3" />
          )}
          <span>Clean up temporary files</span>
        </button>

        <button
          type="button"
          onClick={dismissBanner}
          className="p-1 hover:bg-amber-500/20 rounded text-amber-700 dark:text-amber-300 transition-colors"
          title="Dismiss notice"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
