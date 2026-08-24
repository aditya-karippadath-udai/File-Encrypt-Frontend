import React from 'react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  Activity,
  History,
  ArrowRight,
  HardDrive,
  Cpu,
  Layers,
  FileCheck,
} from 'lucide-react';
import { useUIStore } from '../stores/useUIStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { useQueueStore } from '../stores/useQueueStore';
import { FileDropzone } from '../components/files/FileDropzone';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { formatBytes, formatDateTime } from '../utils/formatters';
import { FileItem } from '../types';

export const DashboardPage: React.FC = () => {
  const { setActiveTab } = useUIStore();
  const { history } = useHistoryStore();
  const { operations, addFilesToQueue } = useQueueStore();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const completedEncrypted = history.filter((h) => h.operation === 'encrypt' && h.status === 'completed').length;
  const completedDecrypted = history.filter((h) => h.operation === 'decrypt' && h.status === 'completed').length;
  const totalProcessedCount = completedEncrypted + completedDecrypted;
  const totalProtectedBytes = history.reduce((acc, h) => acc + h.originalSize, 0);

  const activeQueueCount = operations.filter(
    (op) => op.status === 'processing' || op.status === 'waiting' || op.status === 'paused'
  ).length;

  const handleDashboardFilesDropped = (files: FileItem[]) => {
    // If files are encrypted (.enc), redirect to Decrypt with those files preloaded
    // Otherwise redirect to Encrypt
    const hasEncrypted = files.some((f) => f.isEncrypted || f.name.endsWith('.enc'));
    if (hasEncrypted) {
      sessionStorage.setItem('aegis_pending_decrypt_files', JSON.stringify(files));
      setActiveTab('decrypt');
    } else {
      sessionStorage.setItem('aegis_pending_encrypt_files', JSON.stringify(files));
      setActiveTab('encrypt');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            {getGreeting()}
            <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-medium">
              READY
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Secure your files locally with authenticated 256-bit AEAD encryption.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            icon={<Lock className="w-4 h-4" />}
            onClick={() => setActiveTab('encrypt')}
          >
            Encrypt Files
          </Button>
          <Button
            variant="secondary"
            icon={<Unlock className="w-4 h-4" />}
            onClick={() => setActiveTab('decrypt')}
          >
            Decrypt Files
          </Button>
        </div>
      </div>

      {/* Main Dropzone Section */}
      <div className="p-1 rounded-2xl bg-gradient-to-b from-blue-600/15 via-transparent to-transparent">
        <FileDropzone
          onFilesSelected={handleDashboardFilesDropped}
          title="Drop files here to start"
          subtitle="Auto-detects plain files for encryption or .enc containers for decryption"
        />
      </div>

      {/* Statistics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 bg-[#0D1117] border border-slate-800 rounded-xl space-y-1.5 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Files Processed</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            {totalProcessedCount}
          </div>
          <div className="text-[11px] text-slate-500">Across local sessions</div>
        </div>

        <div className="p-4 bg-[#0D1117] border border-slate-800 rounded-xl space-y-1.5 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Encrypted Files</span>
            <Lock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 font-mono">{completedEncrypted}</div>
          <div className="text-[11px] text-slate-500">XChaCha20-Poly1305</div>
        </div>

        <div className="p-4 bg-[#0D1117] border border-slate-800 rounded-xl space-y-1.5 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Decrypted Files</span>
            <Unlock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-400 font-mono">{completedDecrypted}</div>
          <div className="text-[11px] text-slate-500">Integrity verified</div>
        </div>

        <div className="p-4 bg-[#0D1117] border border-slate-800 rounded-xl space-y-1.5 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Protected Payload</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {formatBytes(totalProtectedBytes)}
          </div>
          <div className="text-[11px] text-slate-500">Processed safely on device</div>
        </div>
      </div>

      {/* Active Queue Banner if items running */}
      {activeQueueCount > 0 && (
        <div
          onClick={() => setActiveTab('queue')}
          className="p-4 bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-blue-950/40 border border-blue-500/30 rounded-xl flex items-center justify-between cursor-pointer hover:border-blue-500/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
            <div>
              <h4 className="text-xs font-semibold text-blue-200">
                {activeQueueCount} operation{activeQueueCount > 1 ? 's' : ''} currently queued or running
              </h4>
              <p className="text-[11px] text-slate-400">
                Click to monitor live throughput, block encryption, and batch progress.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-blue-400 font-semibold">
            <span>Open Queue</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Split: Recent Activity + Security Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Activity (2 cols) */}
        <div className="lg:col-span-2 p-5 bg-[#0D1117] border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-100">Recent Activity</h3>
            </div>
            <button
              onClick={() => setActiveTab('history')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-800/60">
            {history.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-md bg-[#111827] border border-slate-800 flex items-center justify-center shrink-0">
                    {item.operation === 'encrypt' ? (
                      <Lock className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-purple-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-200 truncate">{item.fileName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {formatBytes(item.originalSize)} • {formatDateTime(item.timestamp)}
                    </div>
                  </div>
                </div>

                <Badge
                  variant={item.status === 'completed' ? 'success' : 'danger'}
                  size="sm"
                >
                  {item.status === 'completed'
                    ? item.operation === 'encrypt'
                      ? 'Encrypted'
                      : 'Decrypted'
                    : 'Failed'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Security Engine Status (1 col) */}
        <div className="p-5 bg-[#0D1117] border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">Security Architecture</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-2.5 bg-[#090D12] border border-slate-800/80 rounded-lg space-y-1">
              <div className="flex items-center justify-between font-medium text-slate-300">
                <span>Cipher Core</span>
                <span className="text-blue-400 font-mono text-[11px]">XChaCha20-Poly1305</span>
              </div>
              <p className="text-[11px] text-slate-500">
                192-bit nonce with authenticated message tag verification.
              </p>
            </div>

            <div className="p-2.5 bg-[#090D12] border border-slate-800/80 rounded-lg space-y-1">
              <div className="flex items-center justify-between font-medium text-slate-300">
                <span>Key Derivation</span>
                <span className="text-purple-400 font-mono text-[11px]">Argon2id</span>
              </div>
              <p className="text-[11px] text-slate-500">
                64MB RAM, 4 iterations, resistant to GPU/ASIC attacks.
              </p>
            </div>

            <div className="p-2.5 bg-[#090D12] border border-slate-800/80 rounded-lg space-y-1">
              <div className="flex items-center justify-between font-medium text-slate-300">
                <span>Integrity</span>
                <span className="text-emerald-400 font-mono text-[11px]">AEAD + SHA-256</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Tamper detection guarantees ciphertext integrity before decryption.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
