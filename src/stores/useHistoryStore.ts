import { create } from 'zustand';
import { HistoryItem, OperationType } from '../types';
import { generateId } from '../utils/formatters';

interface HistoryState {
  history: HistoryItem[];
  addHistoryItem: (item: Omit<HistoryItem, 'id'>) => void;
  deleteHistoryItem: (id: string) => void;
  clearHistory: () => void;
  filter: 'all' | OperationType | 'failed';
  searchQuery: string;
  setFilter: (filter: 'all' | OperationType | 'failed') => void;
  setSearchQuery: (query: string) => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  history: [],
  filter: 'all',
  searchQuery: '',

  addHistoryItem: (item) =>
    set((state) => ({
      history: [{ ...item, id: generateId('hist') }, ...state.history],
    })),

  deleteHistoryItem: (id) =>
    set((state) => ({
      history: state.history.filter((item) => item.id !== id),
    })),

  clearHistory: () => set({ history: [] }),

  setFilter: (filter) => set({ filter }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
