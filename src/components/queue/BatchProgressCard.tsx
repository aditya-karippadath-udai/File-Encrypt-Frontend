import React from 'react';
import {
  Layers,
  Pause,
  Play,
  X,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
} from 'lucide-react';
import { useQueueStore } from '../../stores/useQueueStore';
import { formatBytes } from '../../utils/formatters';
import { ProgressBar } from '../ui/ProgressBar';
import { Button } from '../ui/Button';

export const BatchProgressCard: React.FC = () => {
  const { operations, pauseAll, resumeAll, cancelAll, clearCompleted } = useQueueStore();

  if (operations.length === 0) return null;

  const totalFiles = operations.length;
  const completedCount = operations.filter((op) => op.status === 'completed').length;
  const failedCount = operations.filter((op) => op.status === 'failed').length;
  const processingCount = operations.filter((op) => op.status === 'processing').length;
  const pausedCount = operations.filter((op) => op.status === 'paused').length;
  const waitingCount = operations.filter((op) => op.status === 'waiting').length;

  const totalBytes = operations.reduce((acc, op) => acc + (op.file.size || 0), 0);
  const totalProcessedBytes = operations.reduce(
    (acc, op) => acc + (op.progress.bytesProcessed || 0),
    0
  );

  const overallPercent =
    totalBytes > 0 ? Math.min(100, Math.round((totalProcessedBytes / totalBytes) * 100)) : 0;

  const hasProcessing = processingCount > 0;
  const hasPaused = pausedCount > 0;

  return (
    <div className="p-5 bg-gradient-to-b from-blue-50/70 to-white/90 dark:from-[#0F172A]/80 dark:to-[#0D1117] border border-blue-200 dark:border-blue-900/30 rounded-2xl shadow-xl space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-600/20 border border-blue-500/20 dark:border-blue-500/30 flex items-center justify-center text-[#2563EB] dark:text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
              Batch Queue Status
              {hasProcessing && (
                <span className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-blue-400 animate-ping" />
              )}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              {completedCount} of {totalFiles} files processed ({formatBytes(totalProcessedBytes)} of{' '}
              {formatBytes(totalBytes)})
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {hasProcessing ? (
            <Button
              size="xs"
              variant="outline"
              icon={<Pause className="w-3.5 h-3.5" />}
              onClick={pauseAll}
            >
              Pause All
            </Button>
          ) : hasPaused ? (
            <Button
              size="xs"
              variant="primary"
              icon={<Play className="w-3.5 h-3.5" />}
              onClick={resumeAll}
            >
              Resume All
            </Button>
          ) : null}

          {(hasProcessing || waitingCount > 0 || hasPaused) && (
            <Button
              size="xs"
              variant="danger"
              icon={<X className="w-3.5 h-3.5" />}
              onClick={cancelAll}
            >
              Cancel All
            </Button>
          )}

          {(completedCount > 0 || failedCount > 0) && (
            <Button
              size="xs"
              variant="secondary"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={clearCompleted}
            >
              Clear Completed
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#64748B] dark:text-slate-400 font-sans">Overall Progress</span>
          <span className="text-[#2563EB] dark:text-blue-400 font-bold">{overallPercent}%</span>
        </div>
        <ProgressBar
          value={overallPercent}
          size="md"
          variant={overallPercent === 100 ? 'success' : 'primary'}
          animated={hasProcessing}
        />
      </div>

      {/* Stats summary grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 p-2 bg-white/70 dark:bg-[#090D12]/70 rounded-lg border border-slate-200 dark:border-slate-800/60">
          <Clock className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-[#64748B] dark:text-slate-500 uppercase tracking-wider">Active/Waiting</div>
            <div className="font-mono font-semibold text-[#0F172A] dark:text-slate-200">
              {processingCount + waitingCount} files
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 bg-white/70 dark:bg-[#090D12]/70 rounded-lg border border-slate-200 dark:border-slate-800/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] dark:text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-[#64748B] dark:text-slate-500 uppercase tracking-wider">Completed</div>
            <div className="font-mono font-semibold text-[#16A34A] dark:text-emerald-400">{completedCount} files</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 bg-white/70 dark:bg-[#090D12]/70 rounded-lg border border-slate-200 dark:border-slate-800/60">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-[#64748B] dark:text-slate-500 uppercase tracking-wider">Failed</div>
            <div className="font-mono font-semibold text-red-500 dark:text-red-400">{failedCount} files</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 bg-white/70 dark:bg-[#090D12]/70 rounded-lg border border-slate-200 dark:border-slate-800/60">
          <Activity className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-[#64748B] dark:text-slate-500 uppercase tracking-wider">Total Payload</div>
            <div className="font-mono font-semibold text-[#0F172A] dark:text-slate-200">{formatBytes(totalBytes)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
