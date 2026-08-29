import React, { useState, useEffect } from 'react';
import {
  Lock,
  Folder,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Settings,
  Sparkles,
} from 'lucide-react';
import { FileItem } from '../types';
import { useQueueStore } from '../stores/useQueueStore';
import { useUIStore } from '../stores/useUIStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useToastStore } from '../stores/useToastStore';
import { FileDropzone } from '../components/files/FileDropzone';
import { FileList } from '../components/files/FileList';
import { PasswordInput } from '../components/password/PasswordInput';
import { PasswordStrengthMeter } from '../components/password/PasswordStrengthMeter';
import { Button } from '../components/ui/Button';
import { desktopService } from '../services/desktop/mockDesktopService';
import { formatBytes } from '../utils/formatters';

export const EncryptPage: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [outputFolderChoice, setOutputFolderChoice] = useState<'same' | 'custom'>('same');
  const [customPath, setCustomPath] = useState('~/Documents/AegisOutput');

  const { addFilesToQueue } = useQueueStore();
  const { setActiveTab } = useUIStore();
  const { settings } = useSettingsStore();
  const { addToast } = useToastStore();

  // Check for pre-loaded files from dashboard drop
  useEffect(() => {
    const saved = sessionStorage.getItem('aegis_pending_encrypt_files');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedFiles((prev) => [...prev, ...parsed]);
        }
      } catch {
        // ignore
      }
      sessionStorage.removeItem('aegis_pending_encrypt_files');
    }
  }, []);

  const handleFilesAdded = (files: FileItem[]) => {
    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const filtered = files.filter((f) => !existingNames.has(f.name));
      if (filtered.length < files.length) {
        addToast({
          type: 'warning',
          title: 'Duplicate Files Skipped',
          message: 'Files with identical names were already added to the batch.',
        });
      }
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

  const handleQuickLoadDemos = () => {
    const demos = desktopService.getSampleDemoFiles(false);
    handleFilesAdded(demos);
  };

  // Validation rules
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isPasswordValid = password.length >= 8;
  const isFormValid = selectedFiles.length > 0 && isPasswordValid && passwordsMatch;

  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleEncryptSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      if (selectedFiles.length === 0) {
        addToast({
          type: 'warning',
          title: 'No files selected',
          message: 'Please add at least one file to encrypt.',
        });
      } else if (!isPasswordValid) {
        addToast({
          type: 'warning',
          title: 'Weak Password',
          message: 'Password must be at least 8 characters long.',
        });
      } else if (!passwordsMatch) {
        addToast({
          type: 'error',
          title: 'Password Mismatch',
          message: 'The confirmation password does not match.',
        });
      }
      return;
    }

    // Add to queue
    const opIds = addFilesToQueue(selectedFiles, 'encrypt', password, true);

    addToast({
      type: 'info',
      title: 'Batch Encryption Started',
      message: `Enqueued ${selectedFiles.length} file(s) for background processing.`,
      action: {
        label: 'View Queue',
        onClick: () => setActiveTab('queue'),
      },
    });

    // Reset local form and switch to queue
    setSelectedFiles([]);
    setPassword('');
    setConfirmPassword('');
    setActiveTab('queue');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
            Encrypt Files
          </h1>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
            Encrypt local files with authenticated XChaCha20-Poly1305 encryption.
          </p>
        </div>

        {selectedFiles.length === 0 && (
          <Button
            size="xs"
            variant="outline"
            icon={<Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
            onClick={handleQuickLoadDemos}
          >
            Insert Demo Files
          </Button>
        )}
      </div>

      <form onSubmit={handleEncryptSubmit} className="space-y-6">
        {/* Dropzone */}
        <FileDropzone
          onFilesSelected={handleFilesAdded}
          title="Drop files here to encrypt"
          subtitle="Support for any file format, archives, databases, documents, and media"
        />

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <FileList
            files={selectedFiles}
            onRemoveFile={handleRemoveFile}
            onClearAll={handleClearAll}
            title="Files to Encrypt"
          />
        )}

        {/* Password & Security Configuration */}
        <div className="p-5 bg-white/80 dark:bg-[#0D1117]/70 backdrop-blur-md border border-slate-200 dark:border-[#1F2937] rounded-xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#1F2937]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Encryption Password</h3>
            </div>
            <span className="text-[11px] text-[#64748B] font-mono">
              XChaCha20-Poly1305 + Argon2id
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <PasswordInput
                label="Master Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter strong password (min 8 chars)"
                error={password.length > 0 && password.length < 8 ? 'Password must be at least 8 characters' : undefined}
              />

              <PasswordInput
                label="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                error={
                  confirmPassword.length > 0 && !passwordsMatch
                    ? 'Passwords do not match'
                    : undefined
                }
              />
            </div>

            {/* Password strength visualizer */}
            <div>
              <PasswordStrengthMeter password={password} />
            </div>
          </div>
        </div>

        {/* Output Settings */}
        <div className="p-4 bg-white/80 dark:bg-[#0D1117]/70 backdrop-blur-md border border-slate-200 dark:border-[#1F2937] rounded-xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
            <span className="flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" /> Output Location
            </span>
            <span className="text-[#64748B] font-mono text-[11px]">Desktop Target</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                outputFolderChoice === 'same'
                  ? 'border-[#2563EB]/50 bg-blue-500/10 text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'border-slate-200 dark:border-[#1F2937] bg-slate-50/70 dark:bg-[#090D12]/80 text-[#64748B] hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="outputChoice"
                checked={outputFolderChoice === 'same'}
                onChange={() => setOutputFolderChoice('same')}
                className="mt-0.5 text-[#2563EB] focus:ring-[#2563EB]"
              />
              <div>
                <div className="font-semibold text-[#1E293B] dark:text-[#CBD5E1]">Same folder as original</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Appends <code className="font-mono text-[#2563EB] dark:text-[#60A5FA]">.enc</code> to the original filename.
                </div>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                outputFolderChoice === 'custom'
                  ? 'border-[#2563EB]/50 bg-blue-500/10 text-[#0F172A] dark:text-[#F8FAFC]'
                  : 'border-slate-200 dark:border-[#1F2937] bg-slate-50/70 dark:bg-[#090D12]/80 text-[#64748B] hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="outputChoice"
                checked={outputFolderChoice === 'custom'}
                onChange={() => setOutputFolderChoice('custom')}
                className="mt-0.5 text-[#2563EB] focus:ring-[#2563EB]"
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[#1E293B] dark:text-[#CBD5E1]">Custom Vault Folder</div>
                <div className="text-[11px] text-[#64748B] font-mono truncate mt-0.5" title={customPath}>
                  {customPath}
                </div>
                {outputFolderChoice === 'custom' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleChooseCustomDir();
                    }}
                    className="mt-2 text-[11px] text-[#2563EB] dark:text-[#60A5FA] hover:text-blue-700 dark:hover:text-[#93C5FD] font-medium underline underline-offset-2 cursor-pointer"
                  >
                    Change directory
                  </button>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="p-4 bg-white/80 dark:bg-[#090D12]/80 backdrop-blur-md border border-slate-200 dark:border-[#1F2937] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="text-xs text-[#64748B] font-mono">
            {selectedFiles.length > 0 ? (
              <span>
                {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} queued •{' '}
                <strong className="text-[#1E293B] dark:text-[#CBD5E1] font-semibold">{formatBytes(totalBytes)}</strong>
              </span>
            ) : (
              <span className="text-[#64748B]">No files selected</span>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            variant="primary"
            disabled={!isFormValid}
            icon={<Lock className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Encrypt {selectedFiles.length > 0 ? `${selectedFiles.length} Files` : 'Files'}
          </Button>
        </div>
      </form>
    </div>
  );
};
