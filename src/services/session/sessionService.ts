import { OperationSummary } from '../../types';

function getTauriInvoke(): ((cmd: string, args?: Record<string, unknown>) => Promise<any>) | null {
  if (typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
    return (window as any).__TAURI__.core.invoke;
  }
  return null;
}

export interface SessionOperationService {
  getSessionOperations(): Promise<OperationSummary[]>;
  getSessionOperation(operationId: string): Promise<OperationSummary | null>;
  clearSessionOperations(): Promise<void>;
  recordBrowserSessionSummary(summary: OperationSummary): void;
}

export class TauriSessionOperationService implements SessionOperationService {
  private invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const invokeFn = getTauriInvoke();
    if (!invokeFn) {
      return Promise.reject(new Error(`Tauri invoke is not available: ${cmd}`));
    }
    return invokeFn(cmd, args);
  }

  async getSessionOperations(): Promise<OperationSummary[]> {
    return this.invoke<OperationSummary[]>('get_session_operations');
  }

  async getSessionOperation(operationId: string): Promise<OperationSummary | null> {
    return this.invoke<OperationSummary | null>('get_session_operation', { operationId });
  }

  async clearSessionOperations(): Promise<void> {
    return this.invoke<void>('clear_session_operations');
  }

  recordBrowserSessionSummary(_summary: OperationSummary): void {
    // In Tauri, recorded automatically in Rust backend
  }
}

export class MockSessionOperationService implements SessionOperationService {
  private summaries: OperationSummary[] = [];

  async getSessionOperations(): Promise<OperationSummary[]> {
    return [...this.summaries];
  }

  async getSessionOperation(operationId: string): Promise<OperationSummary | null> {
    return this.summaries.find((s) => s.operation_id === operationId) || null;
  }

  async clearSessionOperations(): Promise<void> {
    this.summaries = [];
  }

  recordBrowserSessionSummary(summary: OperationSummary): void {
    this.summaries.unshift(summary);
  }
}
