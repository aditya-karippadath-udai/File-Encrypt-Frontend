import { FileItem } from '../../types';
import {
  BatchSummary,
  FileDialogOptions,
  FileMetadata,
  FileService,
  FileValidationResult,
  OutputConflictResult,
  TempFileResult,
} from './fileService';

// Safe dynamic accessor for window.__TAURI__.core.invoke
function getTauriInvoke(): ((cmd: string, args?: Record<string, unknown>) => Promise<any>) | null {
  if (typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
    return (window as any).__TAURI__.core.invoke;
  }
  return null;
}

export class TauriFileService implements FileService {
  private invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const invokeFn = getTauriInvoke();
    if (!invokeFn) {
      return Promise.reject(new Error(`Tauri invoke is not available in browser mode for command: ${cmd}`));
    }
    return invokeFn(cmd, args);
  }

  async selectFiles(options?: FileDialogOptions): Promise<FileItem[]> {
    const metaList = await this.invoke<FileMetadata[]>('select_files', { options });
    if (!metaList || metaList.length === 0) {
      return [];
    }

    return metaList.map((meta) => ({
      id: `native-file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: meta.name,
      size: meta.sizeBytes,
      type: meta.extension ? `file/${meta.extension}` : 'application/octet-stream',
      path: meta.path,
      lastModified: meta.modifiedAt ? new Date(meta.modifiedAt).getTime() : Date.now(),
      isEncrypted: meta.isEncrypted,
      validationStatus: 'ready',
    }));
  }

  async selectOutputDirectory(): Promise<string | null> {
    return this.invoke<string | null>('select_output_directory');
  }

  async getFileMetadata(path: string): Promise<FileMetadata> {
    return this.invoke<FileMetadata>('get_file_metadata', { path });
  }

  async getFilesMetadata(paths: string[]): Promise<FileValidationResult[]> {
    return this.invoke<FileValidationResult[]>('get_files_metadata', { paths });
  }

  async validateFile(path: string): Promise<FileValidationResult> {
    return this.invoke<FileValidationResult>('validate_file', { path });
  }

  async validateFiles(paths: string[]): Promise<FileValidationResult[]> {
    return this.invoke<FileValidationResult[]>('validate_files', { paths });
  }

  async getBatchSummary(paths: string[]): Promise<BatchSummary> {
    return this.invoke<BatchSummary>('get_batch_summary', { paths });
  }

  async validateOutputDirectory(path: string): Promise<boolean> {
    return this.invoke<boolean>('validate_output_directory', { path });
  }

  async generateOutputPath(
    inputPath: string,
    outputDir?: string,
    mode: 'encrypt' | 'decrypt' = 'encrypt',
    customSuffix?: string
  ): Promise<string> {
    return this.invoke<string>('generate_output_path', {
      inputPath,
      outputDir: outputDir || null,
      mode,
      customSuffix: customSuffix || null,
    });
  }

  async checkOutputConflict(
    inputPath: string,
    outputPath: string
  ): Promise<OutputConflictResult> {
    return this.invoke<OutputConflictResult>('check_output_conflict', {
      inputPath,
      outputPath,
    });
  }

  async prepareTempOutput(targetPath: string): Promise<TempFileResult> {
    return this.invoke<TempFileResult>('prepare_temp_output', { targetPath });
  }

  async cleanupTempFile(tempPath: string): Promise<void> {
    return this.invoke<void>('cleanup_temp_file', { tempPath });
  }
}
