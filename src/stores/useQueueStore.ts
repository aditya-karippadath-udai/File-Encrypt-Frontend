import { create } from 'zustand';
import { EncryptionOperation, FileItem, OperationType, ProcessingProgress } from '../types';
import { encryptionService } from '../services/encryption';
import { useHistoryStore } from './useHistoryStore';
import { useSettingsStore } from './useSettingsStore';
import { useToastStore } from './useToastStore';
import { generateId } from '../utils/formatters';

interface QueueState {
  operations: EncryptionOperation[];
  isProcessingGlobally: boolean;
  abortControllers: Record<string, AbortController>;

  // Actions
  addFilesToQueue: (
    files: FileItem[],
    type: OperationType,
    password?: string,
    autoStart?: boolean
  ) => string[];
  removeOperation: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;

  startProcessing: (targetId?: string) => Promise<void>;
  pauseOperation: (id: string) => void;
  resumeOperation: (id: string) => void;
  cancelOperation: (id: string) => void;
  retryOperation: (id: string) => void;

  pauseAll: () => void;
  resumeAll: () => void;
  cancelAll: () => void;

  updateProgress: (id: string, progress: ProcessingProgress) => void;
}

const INITIAL_PROGRESS: ProcessingProgress = {
  percent: 0,
  bytesProcessed: 0,
  totalBytes: 0,
  speedBytesPerSec: 0,
  timeRemainingSec: 0,
  stageText: 'Queued',
};

export const useQueueStore = create<QueueState>((set, get) => ({
  operations: [],
  isProcessingGlobally: false,
  abortControllers: {},

  addFilesToQueue: (files, type, password, autoStart = true) => {
    const settings = useSettingsStore.getState().settings;
    const newOperations: EncryptionOperation[] = files.map((file) => {
      const isEnc = type === 'encrypt';
      const outputName = isEnc
        ? (file.name.endsWith('.enc') ? file.name : `${file.name}.enc`)
        : (file.name.endsWith('.enc') ? file.name.slice(0, -4) : `decrypted_${file.name}`);

      return {
        id: generateId('op'),
        file,
        type,
        status: 'waiting',
        password,
        progress: {
          ...INITIAL_PROGRESS,
          totalBytes: file.size,
        },
        algorithm: settings.algorithm,
        keyDerivation: settings.keyDerivation,
        outputPath: `${settings.customOutputPath}/${outputName}`,
        outputName,
      };
    });

    set((state) => ({
      operations: [...state.operations, ...newOperations],
    }));

    if (autoStart) {
      setTimeout(() => {
        get().startProcessing();
      }, 50);
    }

    return newOperations.map((op) => op.id);
  },

  removeOperation: (id) => {
    const { abortControllers, operations } = get();
    if (abortControllers[id]) {
      abortControllers[id].abort();
    }
    encryptionService.cancelOperation(id);

    set({
      operations: operations.filter((op) => op.id !== id),
    });
  },

  clearCompleted: () => {
    set((state) => ({
      operations: state.operations.filter(
        (op) => op.status !== 'completed' && op.status !== 'cancelled' && op.status !== 'failed'
      ),
    }));
  },

  clearAll: () => {
    get().cancelAll();
    set({ operations: [] });
  },

  updateProgress: (id, progress) => {
    set((state) => ({
      operations: state.operations.map((op) => (op.id === id ? { ...op, progress } : op)),
    }));
  },

  pauseOperation: (id) => {
    encryptionService.pauseOperation(id);
    set((state) => ({
      operations: state.operations.map((op) => (op.id === id ? { ...op, status: 'paused' } : op)),
    }));
  },

  resumeOperation: (id) => {
    encryptionService.resumeOperation(id);
    set((state) => ({
      operations: state.operations.map((op) => (op.id === id ? { ...op, status: 'processing' } : op)),
    }));
    get().startProcessing();
  },

  cancelOperation: (id) => {
    const { abortControllers } = get();
    if (abortControllers[id]) {
      abortControllers[id].abort();
    }
    encryptionService.cancelOperation(id);

    set((state) => ({
      operations: state.operations.map((op) =>
        op.id === id ? { ...op, status: 'cancelled', progress: { ...op.progress, stageText: 'Cancelled' } } : op
      ),
    }));
  },

  retryOperation: (id) => {
    set((state) => ({
      operations: state.operations.map((op) =>
        op.id === id
          ? {
              ...op,
              status: 'waiting',
              error: undefined,
              progress: { ...INITIAL_PROGRESS, totalBytes: op.file.size },
            }
          : op
      ),
    }));
    get().startProcessing(id);
  },

  pauseAll: () => {
    const { operations } = get();
    operations.forEach((op) => {
      if (op.status === 'processing') {
        encryptionService.pauseOperation(op.id);
      }
    });
    set((state) => ({
      operations: state.operations.map((op) =>
        op.status === 'processing' ? { ...op, status: 'paused' } : op
      ),
    }));
  },

  resumeAll: () => {
    const { operations } = get();
    operations.forEach((op) => {
      if (op.status === 'paused') {
        encryptionService.resumeOperation(op.id);
      }
    });
    set((state) => ({
      operations: state.operations.map((op) =>
        op.status === 'paused' ? { ...op, status: 'waiting' } : op
      ),
    }));
    get().startProcessing();
  },

  cancelAll: () => {
    const { operations, abortControllers } = get();
    Object.values(abortControllers).forEach((ctrl) => ctrl.abort());
    operations.forEach((op) => {
      if (op.status === 'processing' || op.status === 'waiting' || op.status === 'paused') {
        encryptionService.cancelOperation(op.id);
      }
    });

    set((state) => ({
      operations: state.operations.map((op) =>
        op.status === 'processing' || op.status === 'waiting' || op.status === 'paused'
          ? { ...op, status: 'cancelled', progress: { ...op.progress, stageText: 'Cancelled' } }
          : op
      ),
      abortControllers: {},
      isProcessingGlobally: false,
    }));
  },

  startProcessing: async (targetId?: string) => {
    const settings = useSettingsStore.getState().settings;
    const concurrency = settings.concurrency || 2;
    const addToast = useToastStore.getState().addToast;
    const addHistoryItem = useHistoryStore.getState().addHistoryItem;

    const currentOps = get().operations;
    const runningCount = currentOps.filter((o) => o.status === 'processing').length;
    if (runningCount >= concurrency) {
      return;
    }

    const availableSlots = concurrency - runningCount;
    const candidates = targetId
      ? currentOps.filter((o) => o.id === targetId && o.status === 'waiting')
      : currentOps.filter((o) => o.status === 'waiting').slice(0, availableSlots);

    if (candidates.length === 0) {
      const stillActive = get().operations.some((o) => o.status === 'processing');
      set({ isProcessingGlobally: stillActive });
      return;
    }

    set({ isProcessingGlobally: true });

    // Process candidate operations in parallel up to concurrency limit
    candidates.forEach(async (operation) => {
      const controller = new AbortController();
      set((state) => ({
        abortControllers: { ...state.abortControllers, [operation.id]: controller },
        operations: state.operations.map((o) =>
          o.id === operation.id ? { ...o, status: 'processing', startedAt: Date.now() } : o
        ),
      }));

      try {
        const handler =
          operation.type === 'encrypt'
            ? encryptionService.encryptFile.bind(encryptionService)
            : encryptionService.decryptFile.bind(encryptionService);

        const result = await handler(
          operation,
          (progress) => {
            get().updateProgress(operation.id, progress);
          },
          controller.signal
        );

        // On Success
        set((state) => ({
          operations: state.operations.map((o) =>
            o.id === operation.id
              ? {
                  ...o,
                  status: 'completed',
                  completedAt: Date.now(),
                  durationMs: result.durationMs,
                  outputPath: result.outputPath,
                  checksum: result.checksum,
                }
              : o
          ),
        }));

        addHistoryItem({
          fileName: operation.file.name,
          originalSize: operation.file.size,
          outputSize: operation.type === 'encrypt' ? operation.file.size + 1024 : Math.max(0, operation.file.size - 1024),
          operation: operation.type,
          status: 'completed',
          timestamp: Date.now(),
          durationMs: result.durationMs,
          outputPath: result.outputPath,
          checksum: result.checksum,
          algorithm: operation.algorithm || 'XChaCha20-Poly1305',
        });

        addToast({
          type: 'success',
          title: `${operation.type === 'encrypt' ? 'Encryption' : 'Decryption'} completed`,
          message: `${operation.file.name} was successfully ${operation.type === 'encrypt' ? 'encrypted' : 'decrypted'}.`,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown operation failure';
        const isCancelled = errorMsg.toLowerCase().includes('cancelled');

        if (isCancelled) {
          set((state) => ({
            operations: state.operations.map((o) =>
              o.id === operation.id
                ? { ...o, status: 'cancelled', progress: { ...o.progress, stageText: 'Cancelled' } }
                : o
            ),
          }));
        } else {
          set((state) => ({
            operations: state.operations.map((o) =>
              o.id === operation.id
                ? { ...o, status: 'failed', error: errorMsg, progress: { ...o.progress, stageText: 'Failed' } }
                : o
            ),
          }));

          addHistoryItem({
            fileName: operation.file.name,
            originalSize: operation.file.size,
            outputSize: 0,
            operation: operation.type,
            status: 'failed',
            timestamp: Date.now(),
            durationMs: 400,
            outputPath: operation.outputPath || '',
            checksum: '0000000000000000000000000000000000000000000000000000000000000000',
            algorithm: operation.algorithm || 'XChaCha20-Poly1305',
            error: errorMsg,
          });

          addToast({
            type: 'error',
            title: `${operation.type === 'encrypt' ? 'Encryption' : 'Decryption'} failed`,
            message: errorMsg,
          });
        }
      } finally {
        // Clean up controller and trigger next pending item
        set((state) => {
          const newCtrls = { ...state.abortControllers };
          delete newCtrls[operation.id];
          return { abortControllers: newCtrls };
        });

        // Trigger next batch item
        get().startProcessing();
      }
    });
  },
}));
