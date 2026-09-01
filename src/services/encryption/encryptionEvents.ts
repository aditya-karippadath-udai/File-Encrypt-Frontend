import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from '../platform/environment';
import { BatchProgressPayload, JobProgressPayload } from '../../types';

export type BatchProgressHandler = (payload: BatchProgressPayload) => void;
export type JobProgressHandler = (payload: JobProgressPayload) => void;
export type OperationStatusHandler = (payload: BatchProgressPayload) => void;

export interface EncryptionEventHandlers {
  onBatchProgress?: BatchProgressHandler;
  onJobProgress?: JobProgressHandler;
  onOperationStatus?: OperationStatusHandler;
}

// In-memory mock event bus for browser preview mode
class MockEventBus {
  private batchProgressListeners = new Set<BatchProgressHandler>();
  private jobProgressListeners = new Set<JobProgressHandler>();
  private operationStatusListeners = new Set<OperationStatusHandler>();

  public onBatchProgress(handler: BatchProgressHandler): () => void {
    this.batchProgressListeners.add(handler);
    return () => this.batchProgressListeners.delete(handler);
  }

  public onJobProgress(handler: JobProgressHandler): () => void {
    this.jobProgressListeners.add(handler);
    return () => this.jobProgressListeners.delete(handler);
  }

  public onOperationStatus(handler: OperationStatusHandler): () => void {
    this.operationStatusListeners.add(handler);
    return () => this.operationStatusListeners.delete(handler);
  }

  public emitBatchProgress(payload: BatchProgressPayload): void {
    this.batchProgressListeners.forEach((fn) => fn(payload));
  }

  public emitJobProgress(payload: JobProgressPayload): void {
    this.jobProgressListeners.forEach((fn) => fn(payload));
  }

  public emitOperationStatus(payload: BatchProgressPayload): void {
    this.operationStatusListeners.forEach((fn) => fn(payload));
  }
}

export const mockEventBus = new MockEventBus();

/**
 * Sets up listeners for native Tauri or mock browser encryption events.
 * Returns a cleanup unlisten function that unbinds all handlers.
 */
export function setupEncryptionEventListeners(handlers: EncryptionEventHandlers): () => void {
  let isCleanedUp = false;
  const unlistenFns: Array<() => void> = [];

  if (isTauri()) {
    const attachTauriListeners = async () => {
      try {
        if (handlers.onBatchProgress) {
          const unlisten = await listen<BatchProgressPayload>('encryption://progress', (event) => {
            if (!isCleanedUp && handlers.onBatchProgress) {
              handlers.onBatchProgress(event.payload);
            }
          });
          unlistenFns.push(unlisten);
        }

        if (handlers.onJobProgress) {
          const unlisten = await listen<JobProgressPayload>('encryption://job-status', (event) => {
            if (!isCleanedUp && handlers.onJobProgress) {
              handlers.onJobProgress(event.payload);
            }
          });
          unlistenFns.push(unlisten);
        }

        if (handlers.onOperationStatus) {
          const unlisten = await listen<BatchProgressPayload>(
            'encryption://operation-status',
            (event) => {
              if (!isCleanedUp && handlers.onOperationStatus) {
                handlers.onOperationStatus(event.payload);
              }
            }
          );
          unlistenFns.push(unlisten);
        }
      } catch (err) {
        console.warn('Failed to attach Tauri encryption event listeners:', err);
      }
    };

    void attachTauriListeners();
  } else {
    // Browser Mock Event Bus
    if (handlers.onBatchProgress) {
      unlistenFns.push(mockEventBus.onBatchProgress(handlers.onBatchProgress));
    }
    if (handlers.onJobProgress) {
      unlistenFns.push(mockEventBus.onJobProgress(handlers.onJobProgress));
    }
    if (handlers.onOperationStatus) {
      unlistenFns.push(mockEventBus.onOperationStatus(handlers.onOperationStatus));
    }
  }

  return () => {
    isCleanedUp = true;
    for (const unlisten of unlistenFns) {
      try {
        unlisten();
      } catch (err) {
        console.warn('Error during event listener cleanup:', err);
      }
    }
  };
}
