import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileCheck,
  FileWarning,
  RefreshCw,
  SkipForward,
  X,
  XCircle,
} from 'lucide-react';
import { BatchConflictPlan, ConflictAction, OutputConflictStrategy, PlannedOutputItem } from '../../types';
import { Button } from '../ui/Button';

export interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflictPlan: BatchConflictPlan;
  onApplyPlan: (updatedPlan: BatchConflictPlan) => void;
  onCancel: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  conflictPlan,
  onApplyPlan,
  onCancel,
}) => {
  const [items, setItems] = useState<PlannedOutputItem[]>(conflictPlan.items);
  const [globalStrategy, setGlobalStrategy] = useState<OutputConflictStrategy>(
    conflictPlan.global_strategy || 'ask'
  );

  if (!isOpen) return null;

  const applyGlobalAction = (strategy: OutputConflictStrategy) => {
    setGlobalStrategy(strategy);

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.conflict_type === 'none') return item;

        let newAction: ConflictAction = item.chosen_action;
        let newResolvedPath = item.proposed_output_path;
        let newResolvedName = item.proposed_output_name;

        if (strategy === 'skip') {
          newAction = 'skip';
        } else if (strategy === 'rename') {
          newAction = 'rename';
          const dotIdx = item.proposed_output_name.lastIndexOf('.');
          const stem = dotIdx !== -1 ? item.proposed_output_name.substring(0, dotIdx) : item.proposed_output_name;
          const ext = dotIdx !== -1 ? item.proposed_output_name.substring(dotIdx) : '';
          newResolvedName = `${stem} (1)${ext}`;
          const parts = item.proposed_output_path.split(/[/\\]/);
          const parent = parts.slice(0, -1).join('/') || '.';
          newResolvedPath = `${parent}/${newResolvedName}`;
        } else if (strategy === 'overwrite') {
          if (item.can_overwrite) {
            newAction = 'overwrite';
            newResolvedPath = item.proposed_output_path;
            newResolvedName = item.proposed_output_name;
          } else {
            // Cannot overwrite source or invalid
            newAction = 'rename';
            const dotIdx = item.proposed_output_name.lastIndexOf('.');
            const stem = dotIdx !== -1 ? item.proposed_output_name.substring(0, dotIdx) : item.proposed_output_name;
            const ext = dotIdx !== -1 ? item.proposed_output_name.substring(dotIdx) : '';
            newResolvedName = `${stem} (1)${ext}`;
            const parts = item.proposed_output_path.split(/[/\\]/);
            const parent = parts.slice(0, -1).join('/') || '.';
            newResolvedPath = `${parent}/${newResolvedName}`;
          }
        }

        return {
          ...item,
          chosen_action: newAction,
          resolved_output_path: newResolvedPath,
          resolved_output_name: newResolvedName,
        };
      })
    );
  };

  const handlePerItemAction = (jobId: string, action: ConflictAction) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.job_id !== jobId) return item;

        let newResolvedPath = item.proposed_output_path;
        let newResolvedName = item.proposed_output_name;

        if (action === 'rename') {
          const dotIdx = item.proposed_output_name.lastIndexOf('.');
          const stem = dotIdx !== -1 ? item.proposed_output_name.substring(0, dotIdx) : item.proposed_output_name;
          const ext = dotIdx !== -1 ? item.proposed_output_name.substring(dotIdx) : '';
          newResolvedName = `${stem} (1)${ext}`;
          const parts = item.proposed_output_path.split(/[/\\]/);
          const parent = parts.slice(0, -1).join('/') || '.';
          newResolvedPath = `${parent}/${newResolvedName}`;
        }

        return {
          ...item,
          chosen_action: action,
          resolved_output_path: newResolvedPath,
          resolved_output_name: newResolvedName,
        };
      })
    );
  };

  const handleConfirm = () => {
    onApplyPlan({
      ...conflictPlan,
      global_strategy: globalStrategy,
      items,
      has_conflicts: items.some((i) => i.conflict_type !== 'none'),
    });
  };

  const conflictingCount = items.filter((i) => i.conflict_type !== 'none').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#0D1117] border border-slate-200 dark:border-[#1F2937] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-[#1F2937] flex items-center justify-between bg-slate-50/50 dark:bg-[#090D12]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Output Destination Conflicts Detected
              </h2>
              <p className="text-xs text-[#64748B]">
                {conflictingCount} of {items.length} file{items.length === 1 ? '' : 's'} collide with existing destination files.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1F2937] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Action Bar */}
        <div className="p-4 bg-slate-100/70 dark:bg-[#161B22]/70 border-b border-slate-200 dark:border-[#1F2937] flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Batch Conflict Strategy:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyGlobalAction('rename')}
              className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                globalStrategy === 'rename'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-[#0D1117] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-blue-500'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              Auto-Rename All Collisions
            </button>

            <button
              type="button"
              onClick={() => applyGlobalAction('skip')}
              className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                globalStrategy === 'skip'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white dark:bg-[#0D1117] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-amber-500'
              }`}
            >
              <SkipForward className="w-3.5 h-3.5" />
              Skip Existing Files
            </button>

            <button
              type="button"
              onClick={() => applyGlobalAction('overwrite')}
              className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                globalStrategy === 'overwrite'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-white dark:bg-[#0D1117] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-rose-500'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Overwrite Existing
            </button>
          </div>
        </div>

        {/* File Table / List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.map((item) => {
            const hasConflict = item.conflict_type !== 'none';

            return (
              <div
                key={item.job_id}
                className={`p-3.5 rounded-xl border transition-all text-xs space-y-2.5 ${
                  hasConflict
                    ? 'border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10'
                    : 'border-slate-200 dark:border-[#1F2937] bg-white dark:bg-[#090D12]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {hasConflict ? (
                        <FileWarning className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <FileCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="font-semibold text-[#0F172A] dark:text-slate-200 truncate">
                        {item.input_filename}
                      </span>
                      {hasConflict && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          {item.conflict_type === 'file_exists'
                            ? 'File Exists'
                            : item.conflict_type === 'same_as_input'
                            ? 'Identical Path'
                            : item.conflict_type === 'internal_collision'
                            ? 'Batch Collision'
                            : 'Collision'}
                        </span>
                      )}
                    </div>

                    {/* Path Diff Preview */}
                    <div className="mt-2 pl-6 space-y-1 font-mono text-[11px] text-[#64748B]">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 dark:text-slate-500">Destination:</span>
                        <span className="truncate text-slate-600 dark:text-slate-300">
                          {item.proposed_output_name}
                        </span>
                      </div>

                      {hasConflict && (
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-semibold">
                            {item.chosen_action === 'skip' && (
                              <span className="text-amber-600 dark:text-amber-400 font-sans">
                                (Will be skipped)
                              </span>
                            )}
                            {item.chosen_action === 'rename' && (
                              <span>Resolved as: {item.resolved_output_name}</span>
                            )}
                            {item.chosen_action === 'overwrite' && (
                              <span className="text-rose-600 dark:text-rose-400 font-sans">
                                (Will overwrite existing file)
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Per File Choice */}
                  {hasConflict && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handlePerItemAction(item.job_id, 'rename')}
                        className={`px-2.5 py-1 rounded text-[11px] border font-medium cursor-pointer transition-colors ${
                          item.chosen_action === 'rename'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-100 dark:bg-[#1F2937] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        Rename
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePerItemAction(item.job_id, 'skip')}
                        className={`px-2.5 py-1 rounded text-[11px] border font-medium cursor-pointer transition-colors ${
                          item.chosen_action === 'skip'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-100 dark:bg-[#1F2937] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        Skip
                      </button>

                      {item.can_overwrite && (
                        <button
                          type="button"
                          onClick={() => handlePerItemAction(item.job_id, 'overwrite')}
                          className={`px-2.5 py-1 rounded text-[11px] border font-medium cursor-pointer transition-colors ${
                            item.chosen_action === 'overwrite'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-100 dark:bg-[#1F2937] text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          Overwrite
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-[#1F2937] bg-slate-50/50 dark:bg-[#090D12]/50 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel Batch
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handleConfirm} icon={<CheckCircle2 className="w-4 h-4" />}>
              Proceed with Plan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
