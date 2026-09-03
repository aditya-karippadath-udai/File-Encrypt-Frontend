import {
  BatchConflictPlan,
  ConflictAction,
  ConflictType,
  FileItem,
  OutputConflictStrategy,
  PlannedOutputItem,
} from '../../types';
import {
  BatchSummary,
  FileDialogOptions,
  FileMetadata,
  FileService,
  FileValidationResult,
  OutputConflictResult,
  TempFileResult,
} from './fileService';

export class MockFileService implements FileService {
  private knownFiles: Map<string, FileMetadata> = new Map();

  constructor() {
    // Seed initial mock files for rich browser development experience
    this.seedMockFile('/home/user/Documents/Financial_Report_Q3.pdf', 2450000, false);
    this.seedMockFile('/home/user/Documents/tax_returns_2025.pdf.enc', 1890000, true);
    this.seedMockFile('/home/user/SecureVault/passwords_backup.kdbx', 542000, false);
    this.seedMockFile('/home/user/Photos/Family_Vacation_Archive.zip.enc', 84500000, true);
  }

  private seedMockFile(path: string, sizeBytes: number, isEncrypted: boolean) {
    const parts = path.split('/');
    const name = parts[parts.length - 1];
    const dotIdx = name.lastIndexOf('.');
    const extension = dotIdx !== -1 ? name.substring(dotIdx + 1) : undefined;

    this.knownFiles.set(path, {
      path,
      name,
      extension,
      sizeBytes,
      isFile: true,
      isDirectory: false,
      modifiedAt: new Date().toISOString(),
      isEncrypted,
    });
  }

  async selectFiles(options?: FileDialogOptions): Promise<FileItem[]> {
    // In browser, create an invisible HTML file input to allow picking actual local files
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options?.multiple !== false;
      if (options?.encryptedOnly) {
        input.accept = '.enc,.aegis,.vault';
      }

      input.onchange = () => {
        if (!input.files || input.files.length === 0) {
          resolve([]);
          return;
        }

        const items: FileItem[] = Array.from(input.files).map((file) => {
          const isEncrypted =
            file.name.endsWith('.enc') ||
            file.name.endsWith('.aegis') ||
            file.name.endsWith('.vault');

          const virtualPath = `/user/selected/${file.name}`;
          const dotIdx = file.name.lastIndexOf('.');
          const ext = dotIdx !== -1 ? file.name.substring(dotIdx + 1) : undefined;

          // Register in knownFiles map
          this.knownFiles.set(virtualPath, {
            path: virtualPath,
            name: file.name,
            extension: ext,
            sizeBytes: file.size,
            isFile: true,
            isDirectory: false,
            modifiedAt: new Date(file.lastModified).toISOString(),
            isEncrypted,
          });

          return {
            id: `mock-file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            path: virtualPath,
            lastModified: file.lastModified,
            isEncrypted,
            rawFile: file,
            validationStatus: 'ready',
          };
        });

        resolve(items);
      };

      input.oncancel = () => {
        resolve([]);
      };

      input.click();
    });
  }

  async resolveDroppedPaths(paths: string[]): Promise<FileValidationResult[]> {
    return this.validateFiles(paths);
  }

  async selectOutputDirectory(): Promise<string | null> {
    // Simulated browser output directory selection
    const mockFolders = [
      '/Users/Desktop/Encrypted_Output',
      '/home/user/EncryptedVault',
      'C:\\Users\\User\\Documents\\SecureVault',
    ];
    return mockFolders[0];
  }

  async getFileMetadata(path: string): Promise<FileMetadata> {
    if (this.knownFiles.has(path)) {
      return this.knownFiles.get(path)!;
    }

    const parts = path.split(/[/\\]/);
    const name = parts[parts.length - 1] || 'sample.bin';
    const dotIdx = name.lastIndexOf('.');
    const extension = dotIdx !== -1 ? name.substring(dotIdx + 1) : undefined;
    const isEncrypted =
      name.endsWith('.enc') || name.endsWith('.aegis') || name.endsWith('.vault');

    const meta: FileMetadata = {
      path,
      name,
      extension,
      sizeBytes: 1048576, // 1 MB default
      isFile: true,
      isDirectory: false,
      modifiedAt: new Date().toISOString(),
      isEncrypted,
    };

    this.knownFiles.set(path, meta);
    return meta;
  }

  async getFilesMetadata(paths: string[]): Promise<FileValidationResult[]> {
    return this.validateFiles(paths);
  }

  async validateFile(path: string): Promise<FileValidationResult> {
    if (!path || path.trim() === '') {
      return {
        path,
        valid: false,
        error: 'File path cannot be empty',
        errorCode: 'INVALID_PATH',
      };
    }

    try {
      const metadata = await this.getFileMetadata(path);
      return {
        path,
        valid: true,
        metadata,
      };
    } catch (err: any) {
      return {
        path,
        valid: false,
        error: err?.message || 'File validation failed',
        errorCode: 'FILE_NOT_FOUND',
      };
    }
  }

  async validateFiles(paths: string[]): Promise<FileValidationResult[]> {
    return Promise.all(paths.map((p) => this.validateFile(p)));
  }

  async getBatchSummary(paths: string[]): Promise<BatchSummary> {
    const seen = new Set<string>();
    let validFiles = 0;
    let invalidFiles = 0;
    let duplicateFiles = 0;
    let totalSizeBytes = 0;

    for (const path of paths) {
      const normalized = path.toLowerCase().replace(/\\/g, '/');
      if (seen.has(normalized)) {
        duplicateFiles++;
        continue;
      }
      seen.add(normalized);

      const val = await this.validateFile(path);
      if (val.valid && val.metadata) {
        validFiles++;
        totalSizeBytes += val.metadata.sizeBytes;
      } else {
        invalidFiles++;
      }
    }

    return {
      totalFiles: paths.length,
      validFiles,
      invalidFiles,
      duplicateFiles,
      totalSizeBytes,
    };
  }

  async validateOutputDirectory(path: string): Promise<boolean> {
    if (!path || path.trim() === '') {
      throw new Error('Output directory cannot be empty');
    }
    return true;
  }

  async generateOutputPath(
    inputPath: string,
    outputDir?: string,
    mode: 'encrypt' | 'decrypt' = 'encrypt',
    customSuffix: string = '.enc'
  ): Promise<string> {
    const parts = inputPath.split(/[/\\]/);
    const fileName = parts[parts.length - 1] || 'file';

    let outName = fileName;
    if (mode === 'decrypt') {
      if (fileName.endsWith('.enc')) outName = fileName.slice(0, -4);
      else if (fileName.endsWith('.aegis')) outName = fileName.slice(0, -6);
      else if (fileName.endsWith('.vault')) outName = fileName.slice(0, -6);
      else outName = `${fileName}.decrypted`;
    } else {
      if (!fileName.endsWith(customSuffix)) {
        outName = `${fileName}${customSuffix}`;
      }
    }

    if (outputDir) {
      const cleanDir = outputDir.endsWith('/') || outputDir.endsWith('\\')
        ? outputDir.slice(0, -1)
        : outputDir;
      return `${cleanDir}/${outName}`;
    }

    const parent = parts.slice(0, -1).join('/');
    return parent ? `${parent}/${outName}` : outName;
  }

  async checkOutputConflict(
    inputPath: string,
    outputPath: string
  ): Promise<OutputConflictResult> {
    if (!outputPath || outputPath.trim() === '') {
      return {
        status: 'invalidOutput',
        inputPath,
        outputPath,
        message: 'Output path is empty.',
        canOverwrite: false,
      };
    }

    if (inputPath.toLowerCase() === outputPath.toLowerCase()) {
      return {
        status: 'sameAsInput',
        inputPath,
        outputPath,
        message: 'Output path cannot be identical to the source input file.',
        canOverwrite: false,
      };
    }

    return {
      status: 'noConflict',
      inputPath,
      outputPath,
      message: 'Output path is valid with no conflicts.',
      canOverwrite: true,
    };
  }

  async planBatchOutputs(
    inputPaths: string[],
    outputDir?: string,
    mode: 'encrypt' | 'decrypt' = 'encrypt',
    customSuffix?: string,
    globalStrategy: OutputConflictStrategy = 'ask'
  ): Promise<BatchConflictPlan> {
    const items: PlannedOutputItem[] = [];
    const usedPaths = new Set<string>();

    let conflictingFiles = 0;
    let safeFiles = 0;
    let sameAsInputFiles = 0;

    for (let i = 0; i < inputPaths.length; i++) {
      const inPath = inputPaths[i];
      const parts = inPath.split(/[/\\]/);
      const filename = parts[parts.length - 1] || `file_${i}`;

      const proposedOutPath = await this.generateOutputPath(
        inPath,
        outputDir,
        mode,
        customSuffix
      );
      const proposedParts = proposedOutPath.split(/[/\\]/);
      const proposedOutName = proposedParts[proposedParts.length - 1];

      let conflictType: ConflictType = 'none';
      let canOverwrite = true;
      let conflictMessage: string | undefined;

      if (inPath.toLowerCase() === proposedOutPath.toLowerCase()) {
        conflictType = 'same_as_input';
        canOverwrite = false;
        conflictMessage = 'Output destination is identical to input file';
        sameAsInputFiles++;
      } else if (usedPaths.has(proposedOutPath.toLowerCase())) {
        conflictType = 'internal_collision';
        canOverwrite = false;
        conflictMessage = 'Another file in this batch has the same output destination';
        conflictingFiles++;
      } else if (this.knownFiles.has(proposedOutPath)) {
        conflictType = 'file_exists';
        canOverwrite = true;
        conflictMessage = 'Target output file already exists';
        conflictingFiles++;
      } else {
        safeFiles++;
      }

      usedPaths.add(proposedOutPath.toLowerCase());

      let chosenAction: ConflictAction = 'overwrite';
      let resolvedPath = proposedOutPath;
      let resolvedName = proposedOutName;

      if (conflictType !== 'none') {
        switch (globalStrategy) {
          case 'skip':
            chosenAction = 'skip';
            break;
          case 'rename': {
            chosenAction = 'rename';
            const dotIdx = proposedOutName.lastIndexOf('.');
            const stem = dotIdx !== -1 ? proposedOutName.substring(0, dotIdx) : proposedOutName;
            const ext = dotIdx !== -1 ? proposedOutName.substring(dotIdx) : '';
            resolvedName = `${stem} (1)${ext}`;
            const parent = proposedParts.slice(0, -1).join('/') || '.';
            resolvedPath = `${parent}/${resolvedName}`;
            break;
          }
          case 'overwrite':
            chosenAction = canOverwrite ? 'overwrite' : 'rename';
            break;
          case 'ask':
          default:
            chosenAction = canOverwrite ? 'overwrite' : 'rename';
            break;
        }
      }

      items.push({
        job_id: `job-${i + 1}`,
        input_path: inPath,
        input_filename: filename,
        proposed_output_path: proposedOutPath,
        proposed_output_name: proposedOutName,
        conflict_type: conflictType,
        can_overwrite: canOverwrite,
        chosen_action: chosenAction,
        resolved_output_path: resolvedPath,
        resolved_output_name: resolvedName,
        conflict_message: conflictMessage,
      });
    }

    return {
      global_strategy: globalStrategy,
      items,
      has_conflicts: conflictingFiles > 0 || sameAsInputFiles > 0,
      has_fatal_errors: false,
      summary: {
        total_files: inputPaths.length,
        conflicting_files: conflictingFiles,
        safe_files: safeFiles,
        same_as_input_files: sameAsInputFiles,
      },
    };
  }

  async prepareTempOutput(targetPath: string): Promise<TempFileResult> {
    const rand = Math.random().toString(36).substring(2, 8);
    const parts = targetPath.split(/[/\\]/);
    const name = parts[parts.length - 1];
    const parent = parts.slice(0, -1).join('/') || '.';

    return {
      tempPath: `${parent}/.aegis_tmp_${rand}_${name}`,
      targetPath,
      createdAt: new Date().toISOString(),
    };
  }

  async cleanupTempFile(_tempPath: string): Promise<void> {
    // Mock cleanup succeeds silently
  }
}
