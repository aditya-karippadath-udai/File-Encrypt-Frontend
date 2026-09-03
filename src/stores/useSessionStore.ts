import { create } from 'zustand';
import { getSessionOperationService } from '../services/session';
import { OperationSummary } from '../types';

interface SessionState {
  summaries: OperationSummary[];
  isLoading: boolean;

  fetchSummaries: () => Promise<void>;
  addSummary: (summary: OperationSummary) => void;
  clearSessionHistory: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  summaries: [],
  isLoading: false,

  fetchSummaries: async () => {
    set({ isLoading: true });
    try {
      const sessionService = getSessionOperationService();
      const list = await sessionService.getSessionOperations();
      set({ summaries: list, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addSummary: (summary: OperationSummary) => {
    const sessionService = getSessionOperationService();
    sessionService.recordBrowserSessionSummary(summary);
    set((state) => ({
      summaries: [summary, ...state.summaries.filter((s) => s.operation_id !== summary.operation_id)],
    }));
  },

  clearSessionHistory: async () => {
    try {
      const sessionService = getSessionOperationService();
      await sessionService.clearSessionOperations();
      set({ summaries: [] });
    } catch {
      set({ summaries: [] });
    }
  },
}));
