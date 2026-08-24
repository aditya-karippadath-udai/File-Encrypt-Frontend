import React, { useState } from 'react';
import {
  History,
  Search,
  Filter,
  Trash2,
  Download,
  FileCheck,
  Lock,
  Unlock,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useToastStore } from '../stores/useToastStore';
import { HistoryItemRow } from '../components/history/HistoryItemRow';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { formatBytes } from '../utils/formatters';

export const HistoryPage: React.FC = () => {
  const { history, filter, setFilter, searchQuery, setSearchQuery, clearHistory } =
    useHistoryStore();
  const { addToast } = useToastStore();
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const filteredHistory = history.filter((item) => {
    // Tab filter
    if (filter === 'encrypt' && item.operation !== 'encrypt') return false;
    if (filter === 'decrypt' && item.operation !== 'decrypt') return false;
    if (filter === 'failed' && item.status !== 'failed' && item.status !== 'cancelled') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.fileName.toLowerCase().includes(q);
      const matchAlgo = item.algorithm.toLowerCase().includes(q);
      const matchPath = item.outputPath.toLowerCase().includes(q);
      const matchHash = item.checksum.toLowerCase().includes(q);
      return matchName || matchAlgo || matchPath || matchHash;
    }

    return true;
  });

  const handleExportAuditLog = () => {
    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aegis-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addToast({
      type: 'success',
      title: 'Audit Log Exported',
      message: 'Local operations history exported to JSON.',
    });
  };

  const handleConfirmClear = () => {
    clearHistory();
    setIsClearModalOpen(false);
    addToast({
      type: 'info',
      title: 'History Cleared',
      message: 'Local activity audit logs removed.',
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            Activity History
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Local audit logs of completed, decrypted, and failed operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={handleExportAuditLog}
              >
                Export Log
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                onClick={() => setIsClearModalOpen(true)}
                className="text-red-400 hover:text-red-300"
              >
                Clear
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0D1117] p-3 rounded-xl border border-slate-800">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-[#090D12] p-1 rounded-lg border border-slate-800/80 shrink-0">
          {(['all', 'encrypt', 'decrypt', 'failed'] as const).map((tab) => {
            const count =
              tab === 'all'
                ? history.length
                : tab === 'encrypt'
                ? history.filter((h) => h.operation === 'encrypt').length
                : tab === 'decrypt'
                ? history.filter((h) => h.operation === 'decrypt').length
                : history.filter((h) => h.status === 'failed' || h.status === 'cancelled').length;

            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize ${
                  filter === tab
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {tab === 'all'
                  ? 'All'
                  : tab === 'encrypt'
                  ? 'Encrypted'
                  : tab === 'decrypt'
                  ? 'Decrypted'
                  : 'Failed'}{' '}
                ({count})
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file name, path, hash..."
            className="w-full bg-[#090D12] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/40"
          />
        </div>
      </div>

      {/* History Items List */}
      {history.length === 0 ? (
        <div className="p-12 bg-[#0D1117] border border-slate-800 rounded-2xl text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xl">
            <FileCheck className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-200">No activity history</h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Completed operations will automatically appear here with verified cryptographic audit logs.
            </p>
          </div>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-[#0D1117] rounded-xl border border-slate-800">
          No records match the current filter or search criteria.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredHistory.map((item) => (
            <HistoryItemRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Clear Confirmation Modal */}
      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title="Clear Activity History?"
        description="This will remove the local record of past cryptographic operations from the frontend audit log."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsClearModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmClear}>
              Clear History
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-300">
          Note: This action only clears the session log in your interface. Your actual files on disk remain unaffected.
        </p>
      </Modal>
    </div>
  );
};
