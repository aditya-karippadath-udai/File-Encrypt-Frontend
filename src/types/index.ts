export type OperationType = 'encrypt' | 'decrypt';

export type FileStatus = 'waiting' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  lastModified: number;
  isEncrypted: boolean;
  rawFile?: File;
}

export interface ProcessingProgress {
  percent: number;
  bytesProcessed: number;
  totalBytes: number;
  speedBytesPerSec: number;
  timeRemainingSec: number;
  stageText: string;
}

export interface EncryptionOperation {
  id: string;
  file: FileItem;
  type: OperationType;
  status: FileStatus;
  progress: ProcessingProgress;
  password?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
  outputPath?: string;
  outputName?: string;
  checksum?: string;
  algorithm?: string;
  keyDerivation?: string;
}

export interface ProcessingResult {
  operationId: string;
  success: boolean;
  error?: string;
  outputPath: string;
  outputName: string;
  checksum: string;
  durationMs: number;
}

export type ThemeMode = 'dark' | 'light' | 'system';
export type OutputBehavior = 'same-folder' | 'custom-folder' | 'ask';

export interface AppSettings {
  theme: ThemeMode;
  outputBehavior: OutputBehavior;
  customOutputPath: string;
  preserveOriginal: boolean;
  overwriteProtection: boolean;
  autoClearQueue: boolean;
  autoClearDelaySec: number;
  concurrency: number;
  chunkSizeMb: number;
  algorithm: string;
  keyDerivation: string;
}

export interface HistoryItem {
  id: string;
  fileName: string;
  originalSize: number;
  outputSize: number;
  operation: OperationType;
  status: 'completed' | 'failed' | 'cancelled';
  timestamp: number;
  durationMs: number;
  outputPath: string;
  checksum: string;
  algorithm: string;
  error?: string;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastNotification {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export type ActiveTab = 'dashboard' | 'encrypt' | 'decrypt' | 'queue' | 'history' | 'settings';
