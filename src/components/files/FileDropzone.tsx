import React, { useState, useRef } from 'react';
import { Shield, UploadCloud, FolderOpen, FileCheck } from 'lucide-react';
import { FileItem } from '../../types';
import { fileService } from '../../services/files';
import { generateId } from '../../utils/formatters';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export interface FileDropzoneProps {
  onFilesSelected: (files: FileItem[]) => void;
  encryptedOnly?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  encryptedOnly = false,
  title,
  subtitle,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processDroppedFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    // Check if any native paths are available (Tauri drag & drop)
    const nativePaths: string[] = [];
    Array.from(fileList).forEach((file: any) => {
      if (file.path) {
        nativePaths.push(file.path);
      }
    });

    if (nativePaths.length > 0) {
      try {
        const resolved = await fileService.resolveDroppedPaths(nativePaths);
        const validItems: FileItem[] = resolved
          .filter((r) => r.valid && r.metadata)
          .map((r) => {
            const meta = r.metadata!;
            const isEnc =
              meta.name.endsWith('.enc') ||
              meta.name.endsWith('.aegis') ||
              meta.name.endsWith('.vault') ||
              meta.isEncrypted;
            return {
              id: generateId('file'),
              name: meta.name,
              size: meta.sizeBytes,
              type: 'application/octet-stream',
              path: meta.path,
              lastModified: meta.modifiedAt ? new Date(meta.modifiedAt).getTime() : Date.now(),
              isEncrypted: isEnc,
            };
          });

        if (validItems.length > 0) {
          const filtered = encryptedOnly ? validItems.filter((i) => i.isEncrypted) : validItems;
          if (filtered.length > 0) {
            onFilesSelected(filtered);
            return;
          }
        }
      } catch {
        // Fallback to standard FileList extraction
      }
    }

    const items: FileItem[] = Array.from(fileList).map((file) => {
      const isEnc =
        file.name.endsWith('.enc') || file.name.endsWith('.aegis') || file.name.endsWith('.vault');
      return {
        id: generateId('file'),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        path: (file as any).path || file.name,
        lastModified: file.lastModified || Date.now(),
        isEncrypted: isEnc,
        rawFile: file,
      };
    });

    onFilesSelected(items);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processDroppedFiles(e.dataTransfer.files);
  };

  const handleBrowseClick = async () => {
    const selected = await fileService.selectFiles({ encryptedOnly, multiple: true });
    if (selected.length > 0) {
      onFilesSelected(selected);
    }
  };

  return (
    <div className="relative group">
      {/* Ambient background glow behind dropzone */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-[#2563EB]/15 to-[#7C3AED]/15 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200 bg-white/80 dark:bg-[#0D1117]/65 backdrop-blur-md select-none cursor-pointer shadow-xs',
          isDragging
            ? 'border-[#3B82F6] bg-blue-500/10 scale-[0.99] shadow-lg shadow-blue-500/10'
            : 'border-slate-300 dark:border-[#1F2937] hover:border-[#3B82F6]/60 hover:bg-slate-50/90 dark:hover:bg-[#0D1117]/80',
          className
        )}
        onClick={handleBrowseClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => processDroppedFiles(e.target.files)}
          accept={encryptedOnly ? '.enc,.aegis,.vault' : undefined}
        />

        {/* Center Shield Icon */}
        <div
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-105 border shadow-xl',
            isDragging
              ? 'bg-[#2563EB]/20 border-[#3B82F6] text-[#2563EB] dark:text-[#60A5FA]'
              : 'bg-slate-100 dark:bg-[#1F2937] border-slate-200 dark:border-[#1F2937] text-[#2563EB] dark:text-[#60A5FA] shadow-blue-950/10'
          )}
        >
          {isDragging ? (
            <UploadCloud className="w-8 h-8 animate-bounce text-[#2563EB] dark:text-[#60A5FA]" />
          ) : (
            <Shield className="w-8 h-8 text-[#2563EB] dark:text-[#60A5FA]" />
          )}
        </div>

        {/* Main Copy */}
        <h3 className="text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1 tracking-tight">
          {title || (isDragging ? 'Release to add files' : 'Drop files here')}
        </h3>
        <p className="text-xs text-[#64748B] max-w-sm mb-4">
          {subtitle || 'or click anywhere to browse files on your computer'}
        </p>

        {/* Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="primary"
            icon={<FolderOpen className="w-3.5 h-3.5" />}
            onClick={handleBrowseClick}
          >
            Select Files
          </Button>
        </div>

        {/* Privacy Guarantee Pill */}
        <div className="mt-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 dark:bg-[#0D1117]/90 border border-slate-200 dark:border-[#1F2937] text-[11px] text-[#64748B] backdrop-blur-md">
          <FileCheck className="w-3 h-3 text-[#16A34A] dark:text-[#22C55E]" />
          <span>Files stay entirely on your local device</span>
        </div>
      </div>
    </div>
  );
};
