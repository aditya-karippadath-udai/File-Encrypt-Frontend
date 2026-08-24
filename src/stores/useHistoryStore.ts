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

const INITIAL_DEMO_HISTORY: HistoryItem[] = [
  {
    id: 'hist_1',
    fileName: 'financial-report-2025-q4.pdf',
    originalSize: 18.4 * 1024 * 1024,
    outputSize: 18.4 * 1024 * 1024 + 1024,
    operation: 'encrypt',
    status: 'completed',
    timestamp: Date.now() - 1000 * 60 * 18,
    durationMs: 1420,
    outputPath: '~/Documents/Financial/financial-report-2025-q4.pdf.enc',
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    algorithm: 'XChaCha20-Poly1305',
  },
  {
    id: 'hist_2',
    fileName: 'master-database-dump.sql',
    originalSize: 420 * 1024 * 1024,
    outputSize: 420 * 1024 * 1024 + 2048,
    operation: 'encrypt',
    status: 'completed',
    timestamp: Date.now() - 1000 * 60 * 55,
    durationMs: 4180,
    outputPath: '~/Backups/master-database-dump.sql.enc',
    checksum: 'a89c456df923e1b001aef45399cba765412987110bcdef549012398412ffaa11',
    algorithm: 'XChaCha20-Poly1305',
  },
  {
    id: 'hist_3',
    fileName: 'contracts-archive-2026.enc',
    originalSize: 64.2 * 1024 * 1024,
    outputSize: 64.1 * 1024 * 1024,
    operation: 'decrypt',
    status: 'completed',
    timestamp: Date.now() - 1000 * 60 * 130,
    durationMs: 2100,
    outputPath: '~/Vaults/contracts-archive-2026.pdf',
    checksum: '9f83c60a12e345bc789012abcdef34567890123456789abcdef0123456789abc',
    algorithm: 'XChaCha20-Poly1305',
  },
  {
    id: 'hist_4',
    fileName: 'corrupted-key-archive.enc',
    originalSize: 8.5 * 1024 * 1024,
    outputSize: 0,
    operation: 'decrypt',
    status: 'failed',
    timestamp: Date.now() - 1000 * 60 * 240,
    durationMs: 650,
    outputPath: '~/Documents/corrupted-key-archive.enc',
    checksum: '0000000000000000000000000000000000000000000000000000000000000000',
    algorithm: 'XChaCha20-Poly1305',
    error: 'Authentication tag mismatch (invalid password or corrupted MAC)',
  },
];

export const useHistoryStore = create<HistoryState>((set) => ({
  history: INITIAL_DEMO_HISTORY,
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
