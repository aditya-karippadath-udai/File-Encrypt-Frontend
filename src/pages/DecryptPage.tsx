import React, { useState, useEffect } from 'react';
import {
  Unlock,
  Folder,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { FileItem } from '../types';
import { useQueueStore } from '../stores/useQueueStore';
import { useUIStore } from '../stores/useUIStore';
import { useToastStore } from '../stores/useToastStore';
import { FileDropzone } from '../components/files/FileDropzone';
import { FileList } from '../components/files/FileList';
import { PasswordInput } from '../components/password/PasswordInput';
import { Button } from '../components/ui/Button';
import { desktopService } from '../services/desktop/mockDesktopService';
import { formatBytes } from '../utils/formatters';

export const DecryptPage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [password, setPassword] = useState('');
  const [outputFolderChoice, setOutputFolderChoice] = useState<'same' | 'custom'>('same');
  const [customPath, setCustomPath] = useState('~/Documents/AegisOutput');

  const { addFilesToQueue } = useQueueStore();
  const { setActiveTab } = useUIStore();
  const { addToast } = useToastStore();

  // Check for pre-loaded files from dashboard drop
  useEffect(() => {
    const saved = sessionStorage.getItem('aegis_pending_decrypt_files');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedFiles((prev) => [...prev, ...parsed]);
        }
      } catch {
        // ignore
      }
      sessionStorage.removeItem('aegis_pending_decrypt_files');
    }
  }, []);

  const handleFilesAdded = (files: FileItem[]) => {
    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const filtered = files.filter((f) => !existingNames.has(f.name));
      return [...prev, ...filtered];
    });
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
  };

  const handleChooseCustomDir = async () => {
    const dir = await desktopService.selectDirectory();
    if (dir) {
      setCustomPath(dir);
    }
  };

  const handleQuickLoadEncryptedDemos = () => {
    const demos = desktopService.getSampleDemoFiles(true);
    handleFilesAdded(demos);
  };

  const isFormValid = selectedFiles.length > 0 && password.length > 0;
  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleDecryptSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      if (selectedFiles.length === 0) {
        addToast({
          type: 'warning',
          title: 'No files selected',
          message: 'Please add at least one encrypted file to decrypt.',
        });
      } else if (!password) {
        addToast({
          type: 'warning',
          title: 'Password required',
          message: 'Please enter the decryption password.',
        });
      }
      return;
    }

    addFilesToQueue(selectedFiles, 'decrypt', password, true);

    addToast({
      type: 'info',
      title: 'Decryption Started',
      message: `Enqueued ${selectedFiles.length} file(s) for authentication and extraction.`,
      action: {
        label: 'View Queue',
        onClick: () => setActiveTab('queue'),
      },
    });

    setSelectedFiles([]);
    setPassword('');
    setActiveTab('queue');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Unlock className="w-5 h-5 text-purple-400" />
            Decrypt Files
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Authenticate and restore encrypted archives and files with their original master password.
          </p>
        </div>

        {selectedFiles.length === 0 && (
          <Button
            size="xs"
            variant="outline"
            icon={<Sparkles className="w-3.5 h-3.5 text-purple-400" />}
            onClick={handleQuickLoadEncryptedDemos}
          >
            Insert Sample .enc Files
          </Button>
        )}
      </div>

      <form onSubmit={handleDecryptSubmit} className="space-y-6">
        {/* Dropzone */}
        <FileDropzone
          onFilesSelected={handleFilesAdded}
          encryptedOnly={true}
          title="Drop encrypted files here"
          subtitle="Accepts .enc, .aegis, .vault containers or arbitrary encrypted streams"
        />

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <FileList
            files={selectedFiles}
            onRemoveFile={handleRemoveFile}
            onClearAll={handleClearAll}
            title="Files to Decrypt"
          />
        )}

        {/* Password input */}
        <div className="p-5 bg-[#0D1117] border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-slate-100">Decryption Key</h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Poly1305 MAC Verified</span>
          </div>

          <div className="space-y-2 max-w-md">
            <PasswordInput
              label="Decryption Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password used during encryption"
              helperText="Enter password (Tip: type 'wrong' to test simulated MAC mismatch failure)"
            />
          </div>
        </div>

        {/* Output Settings */}
        <div className="p-4 bg-[#0D1117] border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
            <span className="flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-purple-400" /> Output Destination
            </span>
            <span className="text-slate-500 font-mono text-[11px]">Decrypted Storage</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                outputFolderChoice === 'same'
                  ? 'border-purple-500/50 bg-purple-500/5 text-slate-200'
                  : 'border-slate-800 bg-[#090D12] text-slate-400 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="decryptOutputChoice"
                checked={outputFolderChoice === 'same'}
                onChange={() => setOutputFolderChoice('same')}
                className="mt-0.5 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <div className="font-semibold text-slate-200">Same folder as encrypted file</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Restores original extension automatically.
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                outputFolderChoice === 'custom'
                  ? 'border-purple-500/50 bg-purple-500/5 text-slate-200'
                  : 'border-slate-800 bg-[#090D12] text-slate-400 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="decryptOutputChoice"
                checked={outputFolderChoice === 'custom'}
                onChange={() => setOutputFolderChoice('custom')}
                className="mt-0.5 text-purple-600 focus:ring-purple-500"
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-200">Custom Extracted Folder</div>
                <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5" title={customPath}>
                  {customPath}
                </div>
                {outputFolderChoice === 'custom' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleChooseCustomDir();
                    }}
                    className="mt-2 text-[11px] text-purple-400 hover:text-purple-300 font-medium underline underline-offset-2"
                  >
                    Change directory
                  </button>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="p-4 bg-[#090D12] border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-400 font-mono">
            {selectedFiles.length > 0 ? (
              <span>
                {selectedFiles.length} encrypted file{selectedFiles.length > 1 ? 's' : ''} •{' '}
                <strong className="text-slate-200 font-semibold">{formatBytes(totalBytes)}</strong>
              </span>
            ) : (
              <span className="text-slate-500">No encrypted files selected</span>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            variant="primary"
            disabled={!isFormValid}
            icon={<Unlock className="w-4 h-4" />}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 border-purple-500/30"
          >
            Decrypt {selectedFiles.length > 0 ? `${selectedFiles.length} Files` : 'Files'}
          </Button>
        </div>
      </form>
    </div>
  );
};
