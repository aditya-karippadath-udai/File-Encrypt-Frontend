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
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-200">{title}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[11px] font-mono text-slate-300">
            {files.length} {files.length === 1 ? 'file' : 'files'} ({formatBytes(totalBytes)})
          </span>
        </div>

        <Button
          size="xs"
          variant="ghost"
          icon={<Trash2 className="w-3 h-3 text-red-400" />}
          onClick={onClearAll}
          className="text-red-400 hover:text-red-300"
        >
          Clear All
        </Button>
      </div>

      {/* Files container */}
      <div className="bg-[#0D1117] border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between p-3 hover:bg-slate-800/40 transition-colors group"
          >
            {/* File Icon & Info */}
            <div
              className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
              onClick={() => setInspectedItem({ kind: 'file', data: file })}
              title="Click to view file details"
            >
              <div className="w-8 h-8 rounded-lg bg-[#111827] border border-slate-800 flex items-center justify-center shrink-0">
                {getFileIcon(file)}
              </div>

              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-200 truncate group-hover:text-blue-300 transition-colors">
                    {file.name}
                  </span>
                  {file.isEncrypted && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-500/15 text-purple-400 border border-purple-500/25">
                      Encrypted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
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
                className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                title="File details"
                aria-label="Inspect file details"
              >
                <Info className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onRemoveFile(file.id)}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
