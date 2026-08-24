import React, { useState, useRef } from 'react';
import { Shield, UploadCloud, FolderOpen, FileCheck, Sparkles } from 'lucide-react';
import { FileItem } from '../../types';
import { desktopService } from '../../services/desktop/mockDesktopService';
import { generateId } from '../../utils/formatters';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export interface FileDropzoneProps {
  onFilesSelected: (files: FileItem[]) => void;
  encryptedOnly?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
  allowSampleFiles?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  encryptedOnly = false,
  title,
  subtitle,
  className,
  allowSampleFiles = true,
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

  const processDroppedFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const items: FileItem[] = Array.from(fileList).map((file) => {
      const isEnc =
        file.name.endsWith('.enc') || file.name.endsWith('.aegis') || file.name.endsWith('.vault');
      return {
        id: generateId('file'),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        path: `~/Documents/${file.name}`,
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
    const selected = await desktopService.selectFiles({ encryptedOnly, multiple: true });
    if (selected.length > 0) {
      onFilesSelected(selected);
    }
  };

  const handleLoadSamples = () => {
    const samples = desktopService.getSampleDemoFiles(encryptedOnly);
    onFilesSelected(samples);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-200 group bg-[#090D12]/60 select-none cursor-pointer',
        isDragging
          ? 'border-blue-500 bg-blue-500/10 scale-[0.99] shadow-lg shadow-blue-500/10'
          : 'border-slate-800 hover:border-slate-700/80 hover:bg-[#0D1117]/80',
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
            ? 'bg-blue-600/20 border-blue-500 text-blue-400'
            : 'bg-[#111827] border-slate-700/80 text-blue-400 shadow-blue-950/20'
        )}
      >
        {isDragging ? (
          <UploadCloud className="w-8 h-8 animate-bounce text-blue-400" />
        ) : (
          <Shield className="w-8 h-8 text-blue-400" />
        )}
      </div>

      {/* Main Copy */}
      <h3 className="text-base font-semibold text-slate-100 mb-1 tracking-tight">
        {title || (isDragging ? 'Release to add files' : 'Drop files here')}
      </h3>
      <p className="text-xs text-slate-400 max-w-sm mb-4">
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

        {allowSampleFiles && (
          <Button
            size="sm"
            variant="secondary"
            icon={<Sparkles className="w-3.5 h-3.5 text-purple-400" />}
            onClick={handleLoadSamples}
            title="Inject realistic demo test files"
          >
            Load Sample Files
          </Button>
        )}
      </div>

      {/* Privacy Guarantee Pill */}
      <div className="mt-6 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400">
        <FileCheck className="w-3 h-3 text-emerald-400" />
        <span>Files stay entirely on your local device</span>
      </div>
    </div>
  );
};
