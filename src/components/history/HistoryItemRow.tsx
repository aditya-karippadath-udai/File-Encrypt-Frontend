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
    <div className="p-3.5 bg-white/80 dark:bg-[#0D1117]/70 backdrop-blur-md border border-slate-200 dark:border-[#1F2937] rounded-xl hover:border-[#2563EB]/40 hover:bg-slate-50 dark:hover:bg-[#111827]/70 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-xs">
      {/* File & Operation info */}
      <div
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        onClick={() => setInspectedItem({ kind: 'history', data: item })}
      >
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] flex items-center justify-center shrink-0">
          {isEnc ? (
            <Lock className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
          ) : (
            <Unlock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition-colors">
              {item.fileName}
            </span>
            <Badge variant={isEnc ? 'primary' : 'purple'} size="sm">
              {isEnc ? 'Encrypted' : 'Decrypted'}
            </Badge>
            {item.status === 'completed' ? (
              <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3 text-[#16A34A] dark:text-[#22C55E]" />}>
                Success
              </Badge>
            ) : item.status === 'failed' ? (
              <Badge variant="danger" size="sm" icon={<AlertCircle className="w-3 h-3 text-[#DC2626] dark:text-[#EF4444]" />}>
                Failed
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Cancelled
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[#64748B] font-mono mt-1">
            <span>{formatBytes(item.originalSize)}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#64748B]" />
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
          className="p-1.5 text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          title="View metadata"
          aria-label="Inspect history item"
        >
          <Info className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => deleteHistoryItem(item.id)}
          className="p-1.5 text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors cursor-pointer"
          title="Remove record"
          aria-label="Delete history entry"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
