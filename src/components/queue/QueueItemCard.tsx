import React from 'react';
import {
  Lock,
  Unlock,
  Play,
  Pause,
  X,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Info,
} from 'lucide-react';
import { EncryptionOperation } from '../../types';
import { formatBytes, formatDuration, formatSpeed } from '../../utils/formatters';
import { useQueueStore } from '../../stores/useQueueStore';
import { useUIStore } from '../../stores/useUIStore';
import { ProgressBar } from '../ui/ProgressBar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export interface QueueItemCardProps {
  operation: EncryptionOperation;
}

export const QueueItemCard: React.FC<QueueItemCardProps> = ({ operation }) => {
  const { pauseOperation, resumeOperation, cancelOperation, retryOperation, removeOperation } =
    useQueueStore();
  const { setInspectedItem } = useUIStore();

  const isEnc = operation.type === 'encrypt';
  const { status, progress } = operation;

  const getStatusBadge = () => {
    switch (status) {
      case 'processing':
        return (
          <Badge variant="primary" size="sm" icon={<span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}>
            {isEnc ? 'Encrypting' : 'Decrypting'}
          </Badge>
        );
      case 'waiting':
        return (
          <Badge variant="neutral" size="sm" icon={<Clock className="w-3 h-3 text-slate-400" />}>
            Waiting
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="warning" size="sm" icon={<Pause className="w-3 h-3 text-amber-400" />}>
            Paused
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3 text-emerald-400" />}>
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="danger" size="sm" icon={<AlertCircle className="w-3 h-3 text-red-400" />}>
            Failed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="neutral" size="sm" icon={<X className="w-3 h-3 text-slate-500" />}>
            Cancelled
          </Badge>
        );
    }
  };

  const getProgressBarVariant = () => {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'danger';
    if (status === 'paused') return 'warning';
    return isEnc ? 'primary' : 'purple';
  };

  return (
    <div className="p-4 bg-white/80 dark:bg-[#0D1117] border border-slate-200 dark:border-slate-800/90 rounded-xl hover:border-slate-300 dark:hover:border-slate-700/80 transition-all space-y-3 shadow-xs">
      {/* Top Header: File Name + Badges + Actions */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
          onClick={() => setInspectedItem({ kind: 'operation', data: operation })}
        >
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
            {isEnc ? (
              <Lock className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
            ) : (
              <Unlock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-[#0F172A] dark:text-slate-100 truncate group-hover:text-[#2563EB] dark:group-hover:text-blue-300 transition-colors">
                {operation.file.name}
              </h4>
              {getStatusBadge()}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-slate-500 font-mono mt-0.5">
              <span>{formatBytes(operation.file.size)}</span>
              <span>•</span>
              <span className="truncate max-w-[180px]">{operation.file.path}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setInspectedItem({ kind: 'operation', data: operation })}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Inspect operation details"
            aria-label="Inspect operation details"
          >
            <Info className="w-4 h-4" />
          </button>

          {status === 'processing' && (
            <>
              <Button
                size="xs"
                variant="outline"
                icon={<Pause className="w-3 h-3" />}
                onClick={() => pauseOperation(operation.id)}
                title="Pause operation"
              >
                Pause
              </Button>
              <Button
                size="xs"
                variant="danger"
                icon={<X className="w-3 h-3" />}
                onClick={() => cancelOperation(operation.id)}
                title="Cancel operation"
              >
                Cancel
              </Button>
            </>
          )}

          {status === 'paused' && (
            <>
              <Button
                size="xs"
                variant="primary"
                icon={<Play className="w-3 h-3" />}
                onClick={() => resumeOperation(operation.id)}
                title="Resume operation"
              >
                Resume
              </Button>
              <Button
                size="xs"
                variant="danger"
                icon={<X className="w-3 h-3" />}
                onClick={() => cancelOperation(operation.id)}
              >
                Cancel
              </Button>
            </>
          )}

          {status === 'failed' && (
            <Button
              size="xs"
              variant="outline"
              icon={<RotateCcw className="w-3 h-3 text-amber-500 dark:text-amber-400" />}
              onClick={() => retryOperation(operation.id)}
            >
              Retry
            </Button>
          )}

          {(status === 'completed' || status === 'cancelled') && (
            <Button
              size="xs"
              variant="ghost"
              icon={<X className="w-3 h-3" />}
              onClick={() => removeOperation(operation.id)}
              className="text-[#64748B] hover:text-[#0F172A] dark:text-slate-500 dark:hover:text-slate-300"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>

      {/* Progress section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#64748B] dark:text-slate-400 truncate max-w-[280px]">
            {operation.error ? (
              <span className="text-red-500 dark:text-red-400">{operation.error}</span>
            ) : (
              progress.stageText || 'Ready'
            )}
          </span>
          <span className="font-mono font-semibold text-[#0F172A] dark:text-slate-200">{progress.percent}%</span>
        </div>

        <ProgressBar
          value={progress.percent}
          size="sm"
          variant={getProgressBarVariant()}
          animated={status === 'processing'}
        />

        {/* Live Metrics Row */}
        {status === 'processing' && (
          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B] dark:text-slate-400 pt-0.5">
            <span>
              {formatBytes(progress.bytesProcessed)} / {formatBytes(progress.totalBytes)}
            </span>
            <span className="text-[#2563EB] dark:text-blue-400">{formatSpeed(progress.speedBytesPerSec)}</span>
            <span>{formatDuration(progress.timeRemainingSec)} remaining</span>
          </div>
        )}
      </div>
    </div>
  );
};
