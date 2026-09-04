import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileCheck,
  KeyRound,
  Lock,
  Play,
  Plus,
  Sparkles,
  Unlock,
  X,
  Zap,
} from 'lucide-react';
import { FileItem, OperationType } from '../../types';
import { useQueueStore } from '../../stores/useQueueStore';
import { useUIStore } from '../../stores/useUIStore';
import { useToastStore } from '../../stores/useToastStore';
import { Button } from '../ui/Button';
import { PasswordInput } from '../password/PasswordInput';
import { PasswordStrengthMeter } from '../password/PasswordStrengthMeter';
import { formatBytes } from '../../utils/formatters';
import { securityService } from '../../services/security';

export interface QuickQueueModalProps {
  isOpen: boolean;
  files: FileItem[];
  initialType?: OperationType;
  initialPassword?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QuickQueueModal: React.FC<QuickQueueModalProps> = ({
  isOpen,
  files,
  initialType,
  initialPassword = '',
  onClose,
  onSuccess,
}) => {
  const { addFilesToQueue } = useQueueStore();
  const { setActiveTab } = useUIStore();
  const { addToast } = useToastStore();

  const [operationType, setOperationType] = useState<OperationType>(() => {
    if (initialType) return initialType;
    const hasEncrypted = files.some(
      (f) =>
        f.isEncrypted ||
        f.name.endsWith('.enc') ||
        f.name.endsWith('.aegis') ||
        f.name.endsWith('.vault')
    );
    return hasEncrypted ? 'decrypt' : 'encrypt';
  });

  const [password, setPassword] = useState(initialPassword);
  const [confirmPassword, setConfirmPassword] = useState(initialPassword);
  const [autoStart, setAutoStart] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const hasEncrypted = files.some(
        (f) =>
          f.isEncrypted ||
          f.name.endsWith('.enc') ||
          f.name.endsWith('.aegis') ||
          f.name.endsWith('.vault')
      );
      setOperationType(initialType || (hasEncrypted ? 'decrypt' : 'encrypt'));
      setPassword(initialPassword);
      setConfirmPassword(initialPassword);
      setErrorText(null);
    }
  }, [isOpen, files, initialType, initialPassword]);

  if (!isOpen || files.length === 0) return null;

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const isEncrypt = operationType === 'encrypt';

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*()_+~';
    let gen = '';
    const array = new Uint8Array(20);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 20; i++) {
      gen += chars[array[i] % chars.length];
    }
    setPassword(gen);
    setConfirmPassword(gen);
    setErrorText(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (!password) {
      setErrorText('Password is required.');
      return;
    }

    if (isEncrypt) {
      if (password.length < 8) {
        setErrorText('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorText('Passwords do not match.');
        return;
      }

      const validation = await securityService.validatePassword({ password, confirmPassword });
      if (!validation.isValid) {
        setErrorText(validation.errors.join(' ') || 'Password validation failed.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      addFilesToQueue(files, operationType, password, autoStart);

      addToast({
        type: 'success',
        title: `${isEncrypt ? 'Encryption' : 'Decryption'} Enqueued`,
        message: `Added ${files.length} file(s) (${formatBytes(totalBytes)}) to the processing queue.`,
        action: {
          label: 'View Queue',
          onClick: () => setActiveTab('queue'),
        },
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      }

      // Switch to queue page to see execution
      setActiveTab('queue');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to enqueue files';
      setErrorText(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenFullEditor = () => {
    onClose();
    if (isEncrypt) {
      sessionStorage.setItem('aegis_pending_encrypt_files', JSON.stringify(files));
      setActiveTab('encrypt');
    } else {
      sessionStorage.setItem('aegis_pending_decrypt_files', JSON.stringify(files));
      setActiveTab('decrypt');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#0D1117] border border-slate-200 dark:border-[#1F2937] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-[#1F2937] flex items-center justify-between bg-slate-50/70 dark:bg-[#090D12]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Quick Add to Queue
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-[#2563EB] dark:text-[#60A5FA] border border-blue-500/25">
                  Pipeline
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Instantly dispatch files to background processing queue.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1F2937] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* File summary pill */}
          <div className="p-3 bg-slate-50 dark:bg-[#090D12]/70 border border-slate-200 dark:border-[#1F2937] rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              <span className="flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
                {files.length} File{files.length === 1 ? '' : 's'} Selected
              </span>
              <span className="font-mono text-[#64748B]">{formatBytes(totalBytes)}</span>
            </div>

            {/* Micro file list preview */}
            <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-[11px] text-[#64748B]">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-[#161B22] border border-slate-100 dark:border-slate-800 truncate"
                >
                  <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                    {file.name}
                  </span>
                  <span className="shrink-0 ml-2 text-slate-400">{formatBytes(file.size)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Operation selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#1E293B] dark:text-[#CBD5E1]">
              Operation Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setOperationType('encrypt');
                  setErrorText(null);
                }}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                  isEncrypt
                    ? 'bg-blue-500/10 border-[#2563EB] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                    : 'bg-white dark:bg-[#090D12] border-slate-200 dark:border-[#1F2937] text-[#64748B] hover:border-slate-300'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Encrypt Files</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOperationType('decrypt');
                  setErrorText(null);
                }}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                  !isEncrypt
                    ? 'bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'bg-white dark:bg-[#090D12] border-slate-200 dark:border-[#1F2937] text-[#64748B] hover:border-slate-300'
                }`}
              >
                <Unlock className="w-4 h-4" />
                <span>Decrypt Files</span>
              </button>
            </div>
          </div>

          {/* Password inputs */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1E293B] dark:text-[#CBD5E1] flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
                {isEncrypt ? 'Master Password' : 'Decryption Password'}
              </label>

              {isEncrypt && (
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-[#2563EB] dark:text-[#60A5FA] hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Sparkles className="w-3 h-3" />
                  Generate Strong
                </button>
              )}
            </div>

            <PasswordInput
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorText(null);
              }}
              placeholder={isEncrypt ? 'Enter strong password (min 8 chars)' : 'Enter decryption password'}
              autoFocus
            />

            {isEncrypt && (
              <>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrorText(null);
                  }}
                  placeholder="Confirm password"
                  error={
                    confirmPassword.length > 0 && password !== confirmPassword
                      ? 'Passwords do not match'
                      : undefined
                  }
                />
                <PasswordStrengthMeter password={password} showSuggestions={false} />
              </>
            )}

            {errorText && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorText}</span>
              </div>
            )}
          </div>

          {/* Auto-start checkbox */}
          <div className="pt-2 border-t border-slate-100 dark:border-[#1F2937] flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoStart}
                onChange={(e) => setAutoStart(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span>Start processing queue immediately</span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-[#1F2937] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleOpenFullEditor}
              className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
            >
              <span>Full batch configuration</span>
              <ArrowRight className="w-3 h-3" />
            </button>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={isSubmitting}
                icon={autoStart ? <Play className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              >
                {autoStart ? 'Add & Start Queue' : 'Add to Queue'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
