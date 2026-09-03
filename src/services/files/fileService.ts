import { BatchConflictPlan, FileItem, OutputConflictStrategy } from '../../types';

export interface FileMetadata {
  path: string;
  name: string;
  extension?: string;
  sizeBytes: number;
  isFile: boolean;
  isDirectory: boolean;
  modifiedAt?: string;
  isEncrypted: boolean;
}

export interface FileValidationResult {
  path: string;
  valid: boolean;
  metadata?: FileMetadata;
  error?: string;
  errorCode?: string;
}

export interface BatchSummary {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  duplicateFiles: number;
  totalSizeBytes: number;
}

export type OutputConflictStatus =
  | 'noConflict'
  | 'outputExists'
  | 'sameAsInput'
  | 'invalidOutput'
  | 'parentDirectoryMissing';

export interface OutputConflictResult {
  status: OutputConflictStatus;
  inputPath: string;
  outputPath: string;
  message: string;
  canOverwrite: boolean;
}

export interface TempFileResult {
  tempPath: string;
  targetPath: string;
  createdAt: string;
}

export interface FileDialogOptions {
  multiple?: boolean;
  encryptedOnly?: boolean;
  title?: string;
  defaultPath?: string;
}

export interface FileService {
  /**
   * Opens the native file dialog (or browser file picker in browser mode)
   * and returns validated file items.
   */
  selectFiles(options?: FileDialogOptions): Promise<FileItem[]>;

  /**
   * Safely resolves dropped file/folder paths recursively.
   */
  resolveDroppedPaths(paths: string[]): Promise<FileValidationResult[]>;

  /**
   * Opens native directory picker (or browser folder picker) to select output directory.
   */
  selectOutputDirectory(): Promise<string | null>;

  /**
   * Retrieves safe metadata for a specific filesystem path without reading contents.
   */
  getFileMetadata(path: string): Promise<FileMetadata>;

  /**
   * Retrieves metadata for multiple paths in batch.
   */
  getFilesMetadata(paths: string[]): Promise<FileValidationResult[]>;

  /**
   * Validates a single file path for existence, type, and read accessibility.
   */
  validateFile(path: string): Promise<FileValidationResult>;

  /**
   * Validates a batch of files independently.
   */
  validateFiles(paths: string[]): Promise<FileValidationResult[]>;

  /**
   * Computes batch summary statistics including canonical duplicate detection.
   */
  getBatchSummary(paths: string[]): Promise<BatchSummary>;

  /**
   * Validates that an output directory is valid and accessible.
   */
  validateOutputDirectory(path: string): Promise<boolean>;

  /**
   * Generates a safe output destination path.
   */
  generateOutputPath(
    inputPath: string,
    outputDir?: string,
    mode?: 'encrypt' | 'decrypt',
    customSuffix?: string
  ): Promise<string>;

  /**
   * Detects potential output collisions or overwrite safety issues.
   */
  checkOutputConflict(inputPath: string, outputPath: string): Promise<OutputConflictResult>;

  /**
   * Computes comprehensive batch conflict plan across all files.
   */
  planBatchOutputs(
    inputPaths: string[],
    outputDir?: string,
    mode?: 'encrypt' | 'decrypt',
    customSuffix?: string,
    globalStrategy?: OutputConflictStrategy
  ): Promise<BatchConflictPlan>;

  /**
   * Prepares a safe temporary output location.
   */
  prepareTempOutput(targetPath: string): Promise<TempFileResult>;

  /**
   * Cleans up a temporary processing file.
   */
  cleanupTempFile(tempPath: string): Promise<void>;
}
