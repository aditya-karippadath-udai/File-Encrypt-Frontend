import React from 'react';
import {
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
  Info,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { HistoryItem } from '../../types';
import { formatBytes, formatDateTime, formatDurationMs } from '../../utils/formatters';
import { useUIStore } from '../../stores/useUIStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { Badge } from '../ui/Badge';

export interface HistoryItemRowProps {
  item: HistoryItem;
}

export const HistoryItemRow: React.FC<HistoryItemRowProps> = ({ item }) => {
  const { setInspectedItem } = useUIStore();
  const { deleteHistoryItem } = useHistoryStore();

  const isEnc = item.operation === 'encrypt';

  return (
    <div className="p-3.5 bg-[#0D1117] border border-slate-800/80 rounded-xl hover:border-slate-700/80 hover:bg-[#111827]/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
      {/* File & Operation info */}
      <div
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        onClick={() => setInspectedItem({ kind: 'history', data: item })}
      >
        <div className="w-8 h-8 rounded-lg bg-[#111827] border border-slate-800 flex items-center justify-center shrink-0">
          {isEnc ? (
            <Lock className="w-4 h-4 text-blue-400" />
          ) : (
            <Unlock className="w-4 h-4 text-purple-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-100 truncate group-hover:text-blue-300 transition-colors">
              {item.fileName}
            </span>
            <Badge variant={isEnc ? 'primary' : 'purple'} size="sm">
              {isEnc ? 'Encrypted' : 'Decrypted'}
            </Badge>
            {item.status === 'completed' ? (
              <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3 text-emerald-400" />}>
                Success
              </Badge>
            ) : item.status === 'failed' ? (
              <Badge variant="danger" size="sm" icon={<AlertCircle className="w-3 h-3 text-red-400" />}>
                Failed
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Cancelled
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-1">
            <span>{formatBytes(item.originalSize)}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-600" />
              {formatDateTime(item.timestamp)}
            </span>
            <span>•</span>
            <span>{formatDurationMs(item.durationMs)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        <button
          onClick={() => setInspectedItem({ kind: 'history', data: item })}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          title="View metadata"
          aria-label="Inspect history item"
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => deleteHistoryItem(item.id)}
          className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Remove record"
          aria-label="Delete history entry"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
