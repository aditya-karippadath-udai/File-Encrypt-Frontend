import { create } from 'zustand';
import {
  BatchOperationResult,
  BatchProgressPayload,
  JobProgressPayload,
  StartBatchRequest,
} from '../types';
import { encryptionService, setupEncryptionEventListeners } from '../services/encryption';

interface EncryptionOperationState {
  activeOperationId: string | null;
  isRunning: boolean;
  isCancelling: boolean;
  batchProgress: BatchProgressPayload | null;
  jobProgressMap: Record<string, JobProgressPayload>;
  lastResult: BatchOperationResult | null;
  errorMessage: string | null;

  // Actions
  startBatch: (request: StartBatchRequest) => Promise<BatchOperationResult>;
  cancelJob: (jobId: string) => Promise<void>;
  cancelActiveOperation: () => Promise<void>;
  handleBatchProgress: (payload: BatchProgressPayload) => void;
  handleJobProgress: (payload: JobProgressPayload) => void;
  handleOperationStatus: (payload: BatchProgressPayload) => void;
  resetOperation: () => void;
  clearResults: () => void;
}

let eventListenerCleanup: (() => void) | null = null;

export const useEncryptionOperationStore = create<EncryptionOperationState>((set, get) => ({
  activeOperationId: null,
  isRunning: false,
  isCancelling: false,
  batchProgress: null,
  jobProgressMap: {},
  lastResult: null,
  errorMessage: null,

  handleBatchProgress: (payload: BatchProgressPayload) => {
    const currentOpId = get().activeOperationId;
    if (currentOpId && payload.operation_id !== currentOpId) {
      return; // Ignore stale events from older operations
    }

    set({
      batchProgress: payload,
    });
  },

  handleJobProgress: (payload: JobProgressPayload) => {
    const currentOpId = get().activeOperationId;
    if (currentOpId && payload.operation_id !== currentOpId) {
      return;
    }

    set((state) => ({
      jobProgressMap: {
        ...state.jobProgressMap,
        [payload.job_id]: payload,
      },
    }));
  },

  handleOperationStatus: (payload: BatchProgressPayload) => {
    const currentOpId = get().activeOperationId;
    if (currentOpId && payload.operation_id !== currentOpId) {
      return;
    }

    const isTerminal =
      payload.status === 'completed' ||
      payload.status === 'completed_with_errors' ||
      payload.status === 'cancelled' ||
      payload.status === 'failed';

    set({
      batchProgress: payload,
      isRunning: !isTerminal,
      isCancelling: payload.status === 'cancelling',
    });
  },

  startBatch: async (request: StartBatchRequest): Promise<BatchOperationResult> => {
    // Ensure event listeners are attached
    if (!eventListenerCleanup) {
      eventListenerCleanup = setupEncryptionEventListeners({
        onBatchProgress: (payload) => get().handleBatchProgress(payload),
        onJobProgress: (payload) => get().handleJobProgress(payload),
        onOperationStatus: (payload) => get().handleOperationStatus(payload),
      });
    }

    set({
      isRunning: true,
      isCancelling: false,
      errorMessage: null,
      lastResult: null,
      jobProgressMap: {},
      batchProgress: {
        operation_id: '',
        total_files: request.input_files.length,
        completed_files: 0,
        failed_files: 0,
        cancelled_files: 0,
        total_bytes: 0,
        processed_bytes: 0,
        percentage: 0,
        status: 'running',
      },
    });

    try {
      const result = await encryptionService.startBatch(request);
      set({
        activeOperationId: result.operation_id,
        isRunning: false,
        isCancelling: false,
        lastResult: result,
      });
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        isRunning: false,
        isCancelling: false,
        errorMessage: msg,
      });
      throw err;
    }
  },

  cancelJob: async (jobId: string): Promise<void> => {
    const opId = get().activeOperationId;
    if (!opId) return;

    // Optimistically mark as cancelling
    set((state) => {
      const existing = state.jobProgressMap[jobId];
      if (existing) {
        return {
          jobProgressMap: {
            ...state.jobProgressMap,
            [jobId]: { ...existing, status: 'cancelling', stage: 'Cancelling' },
          },
        };
      }
      return state;
    });

    await encryptionService.cancelJob(opId, jobId);
  },

  cancelActiveOperation: async (): Promise<void> => {
    const opId = get().activeOperationId;
    if (!opId) return;

    set({ isCancelling: true });
    await encryptionService.cancelBatch(opId);
  },

  resetOperation: () => {
    set({
      activeOperationId: null,
      isRunning: false,
      isCancelling: false,
      batchProgress: null,
      jobProgressMap: {},
      errorMessage: null,
    });
  },

  clearResults: () => {
    set({
      lastResult: null,
      errorMessage: null,
    });
  },
}));
