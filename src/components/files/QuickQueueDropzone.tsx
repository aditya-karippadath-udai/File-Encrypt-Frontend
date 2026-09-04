import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Zap,
  FolderOpen,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { FileItem } from '../../types';
import { fileService } from '../../services/files';
import { generateId } from '../../utils/formatters';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export interface QuickQueueDropzoneProps {
  onFilesSelected: (files: FileItem[]) => void;
  onQuickEnqueueDirect?: (files: FileItem[]) => void;
  activePassword?: string;
  isPasswordValid?: boolean;
  title?: string;
  subtitle?: string;
  badgeText?: string;
  className?: string;
  compact?: boolean;
  encryptedOnly?: boolean;
}

export const QuickQueueDropzone: React.FC<QuickQueueDropzoneProps> = ({
  onFilesSelected,
  onQuickEnqueueDirect,
  activePassword,
  isPasswordValid = false,
  title = 'Quick Queue Dropzone',
  subtitle = 'Drop files to immediately add to background processing queue',
  badgeText,
  className,
  compact = false,
  encryptedOnly = false,
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

    // Check if native paths are available (Tauri drag & drop)
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
            if (activePassword && isPasswordValid && onQuickEnqueueDirect) {
              onQuickEnqueueDirect(filtered);
            } else {
              onFilesSelected(filtered);
            }
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

    if (activePassword && isPasswordValid && onQuickEnqueueDirect) {
      onQuickEnqueueDirect(items);
    } else {
      onFilesSelected(items);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processDroppedFiles(e.dataTransfer.files);
  };

  const handleBrowseClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const selected = await fileService.selectFiles({ encryptedOnly, multiple: true });
    if (selected.length > 0) {
      if (activePassword && isPasswordValid && onQuickEnqueueDirect) {
        onQuickEnqueueDirect(selected);
      } else {
        onFilesSelected(selected);
      }
    }
  };

  const hasActivePassword = Boolean(activePassword && isPasswordValid);

  return (
    <div className={cn('relative group', className)}>
      {/* Outer ambient glow */}
      <div
        className={cn(
          'absolute -inset-0.5 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none',
          hasActivePassword
            ? 'bg-gradient-to-r from-emerald-500/20 via-blue-500/20 to-indigo-500/20'
            : 'bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20'
        )}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-200 select-none cursor-pointer backdrop-blur-md shadow-xs',
          compact ? 'p-5' : 'p-8',
          isDragging
            ? 'border-[#2563EB] bg-blue-500/15 scale-[0.99] shadow-lg shadow-blue-500/15 ring-2 ring-blue-500/30'
            : hasActivePassword
            ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/70 hover:bg-emerald-500/10'
            : 'border-[#2563EB]/40 dark:border-[#2563EB]/35 bg-white/85 dark:bg-[#0D1117]/75 hover:border-[#2563EB] hover:bg-blue-500/5 dark:hover:bg-[#0D1117]/90'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => processDroppedFiles(e.target.files)}
          accept={encryptedOnly ? '.enc,.aegis,.vault' : undefined}
        />

        {/* Top Badge */}
        <div className="mb-3 flex items-center gap-2">
          {hasActivePassword ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Password Active: Instant Enqueue
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#2563EB]/15 text-[#2563EB] dark:text-[#60A5FA] border border-[#2563EB]/30 shadow-xs">
              <Zap className="w-3.5 h-3.5" />
              {badgeText || 'QUICK QUEUE PIPELINE'}
            </span>
          )}
        </div>

        {/* Center Icon */}
        <div
          className={cn(
            'rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 border shadow-xl',
            compact ? 'w-12 h-12 mb-2.5' : 'w-16 h-16 mb-4',
            isDragging
              ? 'bg-[#2563EB]/25 border-[#2563EB] text-[#2563EB] dark:text-[#60A5FA]'
              : hasActivePassword
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-[#2563EB]/10 dark:bg-[#2563EB]/15 border-[#2563EB]/30 text-[#2563EB] dark:text-[#60A5FA]'
          )}
        >
          {isDragging ? (
            <UploadCloud className={cn('animate-bounce', compact ? 'w-6 h-6' : 'w-8 h-8')} />
          ) : hasActivePassword ? (
            <Sparkles className={compact ? 'w-6 h-6' : 'w-8 h-8'} />
          ) : (
            <Zap className={compact ? 'w-6 h-6' : 'w-8 h-8'} />
          )}
        </div>

        {/* Main Title & Subtitle */}
        <h3
          className={cn(
            'font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight mb-1',
            compact ? 'text-sm' : 'text-base'
          )}
        >
          {isDragging ? 'Release to add to Queue' : title}
        </h3>
        <p
          className={cn(
            'text-[#64748B] max-w-md mx-auto',
            compact ? 'text-[11px] mb-3' : 'text-xs mb-4'
          )}
        >
          {hasActivePassword
            ? 'Drop files here to immediately start encrypting with your entered password!'
            : subtitle}
        </p>

        {/* Action Button */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="primary"
            icon={<FolderOpen className="w-3.5 h-3.5" />}
            onClick={handleBrowseClick}
          >
            Select Files to Queue
          </Button>
        </div>
      </div>
    </div>
  );
};
