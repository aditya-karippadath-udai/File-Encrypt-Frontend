import React, { useState } from 'react';
import {
  ListOrdered,
  Plus,
  Lock,
  Unlock,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useQueueStore } from '../stores/useQueueStore';
import { useUIStore } from '../stores/useUIStore';
import { QueueItemCard } from '../components/queue/QueueItemCard';
import { BatchProgressCard } from '../components/queue/BatchProgressCard';
import { Button } from '../components/ui/Button';
import { desktopService } from '../services/desktop/mockDesktopService';

export const QueuePage: React.FC = () => {
  const { operations, addFilesToQueue } = useQueueStore();
  const { setActiveTab } = useUIStore();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');

  const filteredOps = operations.filter((op) => {
    if (filter === 'active') {
      return op.status === 'processing' || op.status === 'waiting' || op.status === 'paused';
    }
    if (filter === 'completed') return op.status === 'completed';
    if (filter === 'failed') return op.status === 'failed' || op.status === 'cancelled';
    return true;
  });

  const handleInjectSampleBatch = () => {
    const samples = desktopService.getSampleDemoFiles(false);
    addFilesToQueue(samples.slice(0, 3), 'encrypt', 'SecurePass123!@#', true);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-blue-400" />
            Operation Queue
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time batch execution pipeline and throughput monitor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<Sparkles className="w-3.5 h-3.5 text-purple-400" />}
            onClick={handleInjectSampleBatch}
            title="Inject 3 test files into active queue"
          >
            Add Demo Batch
          </Button>

          <Button
            size="sm"
            variant="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setActiveTab('encrypt')}
          >
            New Operation
          </Button>
        </div>
      </div>

      {/* Top Batch Overview */}
      {operations.length > 0 && <BatchProgressCard />}

      {/* Filter Tabs & Count */}
      {operations.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-[#1F2937] pb-3">
          <div className="flex items-center gap-1.5 bg-[#090D12]/80 p-1 rounded-lg border border-[#1F2937]">
            {(['all', 'active', 'completed', 'failed'] as const).map((tab) => {
              const count =
                tab === 'all'
                  ? operations.length
                  : tab === 'active'
                  ? operations.filter(
                      (o) => o.status === 'processing' || o.status === 'waiting' || o.status === 'paused'
                    ).length
                  : tab === 'completed'
                  ? operations.filter((o) => o.status === 'completed').length
                  : operations.filter((o) => o.status === 'failed' || o.status === 'cancelled').length;

              return (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize cursor-pointer ${
                    filter === tab
                      ? 'bg-[#2563EB]/20 text-[#60A5FA] border border-[#2563EB]/40 shadow-xs'
                      : 'text-[#64748B] hover:text-[#CBD5E1] border border-transparent'
                  }`}
                >
                  {tab} ({count})
                </button>
              );
            })}
          </div>

          <span className="text-xs text-[#64748B] font-mono hidden sm:inline-block">
            Showing {filteredOps.length} item{filteredOps.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {/* Empty State */}
      {operations.length === 0 ? (
        <div className="p-12 bg-[#0D1117]/70 backdrop-blur-md border border-[#1F2937] rounded-2xl text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#2563EB]/10 border border-[#2563EB]/30 flex items-center justify-center text-[#60A5FA] shadow-xl">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#F8FAFC]">No active operations</h3>
            <p className="text-xs text-[#64748B] max-w-sm mt-1">
              The queue is currently idle. Drop files to encrypt, decrypt, or test with sample items.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Lock className="w-4 h-4" />}
              onClick={() => setActiveTab('encrypt')}
            >
              Encrypt Files
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Unlock className="w-4 h-4" />}
              onClick={() => setActiveTab('decrypt')}
            >
              Decrypt Files
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Sparkles className="w-4 h-4 text-purple-400" />}
              onClick={handleInjectSampleBatch}
            >
              Test Demo Batch
            </Button>
          </div>
        </div>
      ) : (
        /* Queue Items list */
        <div className="space-y-3">
          {filteredOps.map((op) => (
            <QueueItemCard key={op.id} operation={op} />
          ))}

          {filteredOps.length === 0 && (
            <div className="p-8 text-center text-xs text-[#64748B] bg-[#0D1117]/70 backdrop-blur-md rounded-xl border border-[#1F2937]">
              No operations match the selected filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
