import React from 'react';
import {
  FileText,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  File,
  Lock,
  Trash2,
  Info,
  Layers,
} from 'lucide-react';
import { FileItem } from '../../types';
import { formatBytes } from '../../utils/formatters';
import { useUIStore } from '../../stores/useUIStore';
import { Button } from '../ui/Button';

export interface FileListProps {
  files: FileItem[];
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  title?: string;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  onRemoveFile,
  onClearAll,
  title = 'Selected Files',
}) => {
  const { setInspectedItem } = useUIStore();

  if (files.length === 0) return null;

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);

  const getFileIcon = (file: FileItem) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (file.isEncrypted || ext === 'enc' || ext === 'aegis') {
      return <Lock className="w-4 h-4 text-purple-400" />;
    }
    if (['zip', 'tar', 'gz', '7z', 'rar'].includes(ext || '')) {
      return <FileArchive className="w-4 h-4 text-amber-400" />;
    }
    if (['sql', 'json', 'ts', 'tsx', 'js', 'py', 'rs'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-blue-400" />;
    }
    if (['csv', 'xlsx', 'xls'].includes(ext || '')) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-400" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')) {
      return <FileText className="w-4 h-4 text-red-400" />;
    }
    return <File className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="space-y-2">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
          <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{title}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1F2937] text-[11px] font-mono text-slate-600 dark:text-[#CBD5E1] border border-slate-200 dark:border-transparent">
            {files.length} {files.length === 1 ? 'file' : 'files'} ({formatBytes(totalBytes)})
          </span>
        </div>

        <Button
          size="xs"
          variant="ghost"
          icon={<Trash2 className="w-3 h-3 text-[#EF4444]" />}
          onClick={onClearAll}
          className="text-[#EF4444] hover:text-[#EF4444]/80 cursor-pointer"
        >
          Clear All
        </Button>
      </div>

      {/* Files container */}
      <div className="bg-white/80 dark:bg-[#0D1117]/70 backdrop-blur-md border border-slate-200 dark:border-[#1F2937] rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-[#1F2937] max-h-64 overflow-y-auto shadow-xs">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
          >
            {/* File Icon & Info */}
            <div
              className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
              onClick={() => setInspectedItem({ kind: 'file', data: file })}
              title="Click to view file details"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] flex items-center justify-center shrink-0">
                {getFileIcon(file)}
              </div>

              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] truncate group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition-colors">
                    {file.name}
                  </span>
                  {file.isEncrypted && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25">
                      Encrypted
                    </span>
                  )}
                  {file.validationStatus === 'invalid' && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25" title={file.validationError}>
                      Invalid: {file.validationError || 'Failed Validation'}
                    </span>
                  )}
                  {file.validationStatus === 'duplicate' && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                      Duplicate
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#64748B] font-mono mt-0.5">
                  <span>{formatBytes(file.size)}</span>
                  <span>•</span>
                  <span className="truncate max-w-[200px]">{file.path}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setInspectedItem({ kind: 'file', data: file })}
                className="p-1.5 text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="File details"
                aria-label="Inspect file details"
              >
                <Info className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onRemoveFile(file.id)}
                className="p-1.5 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors cursor-pointer"
                title="Remove file"
                aria-label="Remove file"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
