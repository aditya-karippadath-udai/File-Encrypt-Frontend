import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck,
  FileX,
  KeyRound,
  Lock,
  RefreshCw,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useSessionStore } from '../stores/useSessionStore';
import { useQueueStore } from '../stores/useQueueStore';
import { useUIStore } from '../stores/useUIStore';
import { useToastStore } from '../stores/useToastStore';
import { FileItem, JobSummary, OperationSummary } from '../types';
import { Button } from '../components/ui/Button';
import { PasswordInput } from '../components/password/PasswordInput';
import { formatBytes, formatDuration } from '../utils/formatters';

export const SessionPage: React.FC = () => {
  const { summaries, isLoading, fetchSummaries, clearSessionHistory } = useSessionStore();
  const { addFilesToQueue } = useQueueStore();
  const { setActiveTab } = useUIStore();
  const { addToast } = useToastStore();

  const [selectedOperation, setSelectedOperation] = useState<OperationSummary | null>(null);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryPassword, setRetryPassword] = useState('');
  const [retryJobs, setRetryJobs] = useState<JobSummary[]>([]);
  const [retryOpType, setRetryOpType] = useState<'encrypt' | 'decrypt'>('encrypt');

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const handleOpenRetryModal = (operation: OperationSummary) => {
    const failed = operation.jobs.filter((j) => j.status === 'failed' || j.safe_error);
    if (failed.length === 0) {
      addToast({
        type: 'info',
        title: 'No Failed Files',
        message: 'All files in this operation succeeded.',
      });
      return;
    }

    setRetryJobs(failed);
    setRetryOpType(operation.operation_type);
    setRetryPassword('');
    setRetryModalOpen(true);
  };

  const handleExecuteRetry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!retryPassword || retryJobs.length === 0) return;

    const fileItems: FileItem[] = retryJobs.map((j) => ({
      id: `retry-file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      name: j.input_filename,
      path: j.input_path,
      size: j.total_bytes,
      type: 'application/octet-stream',
      lastModified: Date.now(),
      isEncrypted: retryOpType === 'decrypt',
      validationStatus: 'ready',
    }));

    // Dispatch brand new operation with re-entered password (per security rules)
    addFilesToQueue(fileItems, retryOpType, retryPassword, true);

    addToast({
      type: 'success',
      title: 'Retry Operation Initialized',
      message: `Enqueued ${fileItems.length} failed file(s) as a new ${retryOpType} operation.`,
    });

    setRetryModalOpen(false);
    setActiveTab('queue');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Session Activity & Recovery
          </h1>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
            Real-time in-memory summary of operations performed during this app session.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSummaries()}
            disabled={isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {summaries.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearSessionHistory}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Clear Session
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {summaries.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-200 dark:border-[#1F2937] rounded-2xl bg-white/50 dark:bg-[#0D1117]/50 backdrop-blur-sm">
          <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
            No Session Operations Yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Operations executed during this session will be listed here for quick review and targeted file retry.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="primary" size="sm" onClick={() => setActiveTab('encrypt')} icon={<Lock className="w-3.5 h-3.5" />}>
              Start Encryption
            </Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('decrypt')} icon={<Unlock className="w-3.5 h-3.5" />}>
              Start Decryption
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {summaries.map((op) => {
            const isEnc = op.operation_type === 'encrypt';
            const hasFailed = op.failed_files > 0;

            return (
              <div
                key={op.operation_id}
                className="bg-white/80 dark:bg-[#0D1117]/70 border border-slate-200 dark:border-[#1F2937] rounded-xl p-4 shadow-xs space-y-3"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#1F2937]">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isEnc
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                      }`}
                    >
                      {isEnc ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                          {isEnc ? 'Batch Encryption' : 'Batch Decryption'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            op.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : op.status === 'completed_with_errors' || op.status === 'failed'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {op.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#64748B] mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(op.started_at).toLocaleTimeString()} ({formatDuration(op.duration_ms)})
                        </span>
                        <span>•</span>
                        <span>{op.total_files} file{op.total_files === 1 ? '' : 's'} ({formatBytes(op.total_bytes)})</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {hasFailed && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenRetryModal(op)}
                        icon={<RefreshCw className="w-3.5 h-3.5" />}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        Retry {op.failed_files} Failed File{op.failed_files === 1 ? '' : 's'}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSelectedOperation(
                          selectedOperation?.operation_id === op.operation_id ? null : op
                        )
                      }
                    >
                      {selectedOperation?.operation_id === op.operation_id ? 'Hide Details' : 'View Details'}
                    </Button>
                  </div>
                </div>

                {/* Stat pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090D12] border border-slate-100 dark:border-[#1F2937]">
                    <span className="text-slate-400 text-[10px] block">Successful</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {op.completed_files}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090D12] border border-slate-100 dark:border-[#1F2937]">
                    <span className="text-slate-400 text-[10px] block">Failed</span>
                    <span
                      className={`font-semibold ${
                        op.failed_files > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {op.failed_files}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090D12] border border-slate-100 dark:border-[#1F2937]">
                    <span className="text-slate-400 text-[10px] block">Skipped</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {op.skipped_files}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#090D12] border border-slate-100 dark:border-[#1F2937]">
                    <span className="text-slate-400 text-[10px] block">Throughput</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {formatBytes(op.processed_bytes)}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {selectedOperation?.operation_id === op.operation_id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#1F2937] space-y-2">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      File Outcomes:
                    </h4>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {op.jobs.map((job) => (
                        <div
                          key={job.job_id}
                          className="p-2 rounded-lg bg-slate-50/70 dark:bg-[#090D12]/70 border border-slate-100 dark:border-[#1F2937] flex items-center justify-between text-xs gap-3"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {job.status === 'completed' ? (
                              <FileCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : job.is_skipped ? (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <FileX className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            )}
                            <span className="font-mono text-slate-800 dark:text-slate-200 truncate">
                              {job.input_filename}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-[#64748B]">
                            <span>{formatBytes(job.total_bytes)}</span>
                            {job.safe_error && (
                              <span className="text-rose-600 dark:text-rose-400 text-[10px]">
                                {job.safe_error}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Re-enter Password Modal for Retry (Strict Security Compliance) */}
      {retryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#0D1117] border border-slate-200 dark:border-[#1F2937] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-[#1F2937]">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Retry Failed Files ({retryJobs.length})
                </h3>
                <p className="text-xs text-[#64748B]">
                  Re-enter your password to execute a new operation.
                </p>
              </div>
            </div>

            <div className="text-xs text-[#64748B] space-y-2">
              <p>
                In accordance with zero-trust security architecture, passwords are never stored in memory or on disk. Please provide the master password again:
              </p>
            </div>

            <form onSubmit={handleExecuteRetry} className="space-y-4">
              <PasswordInput
                label="Master Password"
                value={retryPassword}
                onChange={(e) => setRetryPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setRetryModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={!retryPassword}
                  icon={<KeyRound className="w-4 h-4" />}
                >
                  Start Retry Operation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
