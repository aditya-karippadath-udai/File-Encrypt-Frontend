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
          <h1 className="text-2xl font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2.5">
            {getGreeting()}
            <span className="text-xs px-2 py-0.5 rounded-md bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/30 font-mono font-medium backdrop-blur-xs">
              READY
            </span>
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
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
      <FileDropzone
        onFilesSelected={handleDashboardFilesDropped}
        title="Drop files here to start"
        subtitle="Auto-detects plain files for encryption or .enc containers for decryption"
      />

      {/* Statistics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-5 bg-[#0D1117]/70 backdrop-blur-md border border-[#1F2937] rounded-xl space-y-1.5 hover:border-slate-700/80 transition-all shadow-md shadow-black/10">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-semibold uppercase tracking-wider">
            <span>Files Processed</span>
            <Layers className="w-4 h-4 text-[#60A5FA]" />
          </div>
          <div className="text-3xl font-bold text-[#F8FAFC] font-mono">
            {totalProcessedCount}
          </div>
          <div className="text-[11px] text-[#64748B]">Across local sessions</div>
        </div>

        <div className="p-5 bg-[#0D1117]/70 backdrop-blur-md border border-[#1F2937] rounded-xl space-y-1.5 hover:border-slate-700/80 transition-all shadow-md shadow-black/10">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-semibold uppercase tracking-wider">
            <span>Encrypted Files</span>
            <Lock className="w-4 h-4 text-[#60A5FA]" />
          </div>
          <div className="text-3xl font-bold text-[#60A5FA] font-mono">{completedEncrypted}</div>
          <div className="text-[11px] text-[#64748B]">XChaCha20-Poly1305</div>
        </div>

        <div className="p-5 bg-[#0D1117]/70 backdrop-blur-md border border-[#1F2937] rounded-xl space-y-1.5 hover:border-slate-700/80 transition-all shadow-md shadow-black/10">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-semibold uppercase tracking-wider">
            <span>Decrypted Files</span>
            <Unlock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-purple-400 font-mono">{completedDecrypted}</div>
          <div className="text-[11px] text-[#64748B]">Integrity verified</div>
        </div>

        <div className="p-5 bg-[#0D1117]/70 backdrop-blur-md border border-[#1F2937] rounded-xl space-y-1.5 hover:border-slate-700/80 transition-all shadow-md shadow-black/10">
          <div className="flex items-center justify-between text-[#64748B] text-xs font-semibold uppercase tracking-wider">
            <span>Protected Payload</span>
            <HardDrive className="w-4 h-4 text-[#22C55E]" />
          </div>
          <div className="text-3xl font-bold text-[#22C55E] font-mono">
            {formatBytes(totalProtectedBytes)}
          </div>
          <div className="text-[11px] text-[#64748B]">Processed safely on device</div>
        </div>
      </div>

      {/* Active Queue Banner if items running */}
      {activeQueueCount > 0 && (
        <div
          onClick={() => setActiveTab('queue')}
          className="p-4 bg-[#2563EB]/10 border border-[#2563EB]/30 backdrop-blur-md rounded-xl flex items-center justify-between cursor-pointer hover:border-[#2563EB]/50 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#60A5FA] animate-ping" />
            <div>
              <h4 className="text-xs font-semibold text-[#93C5FD]">
                {activeQueueCount} operation{activeQueueCount > 1 ? 's' : ''} currently queued or running
              </h4>
              <p className="text-[11px] text-[#CBD5E1]">
                Click to monitor live throughput, block encryption, and batch progress.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#60A5FA] font-semibold">
            <span>Open Queue</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Split: Recent Activity + Security Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Activity (2 cols) */}
        <div className="lg:col-span-2 p-5 bg-[#0D1117]/70 backdrop-blur-md border border-[#1F2937] rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#60A5FA]" />
              <h3 className="text-base font-bold text-[#F8FAFC]">Recent Activity</h3>
            </div>
            <button
              onClick={() => setActiveTab('history')}
              className="text-xs text-[#60A5FA] hover:text-[#93C5FD] font-medium flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#1F2937]/70">
            {history.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-[#111827] border border-[#1F2937] flex items-center justify-center shrink-0">
                    {item.operation === 'encrypt' ? (
                      <Lock className="w-3.5 h-3.5 text-[#60A5FA]" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-purple-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[#CBD5E1] truncate">{item.fileName}</div>
                    <div className="text-[11px] text-[#64748B] font-mono">
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
        <div className="p-5 bg-[#0D1117]/70 backdrop-blur-md border border-[#1F2937] rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
            <h3 className="text-base font-bold text-[#F8FAFC]">Security Architecture</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#090D12]/80 border border-[#1F2937] rounded-lg space-y-1">
              <div className="flex items-center justify-between font-medium text-[#CBD5E1]">
                <span>Cipher Core</span>
                <span className="text-[#60A5FA] font-mono text-[11px]">XChaCha20-Poly1305</span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                192-bit nonce with authenticated message tag verification.
              </p>
            </div>

            <div className="p-3 bg-[#090D12]/80 border border-[#1F2937] rounded-lg space-y-1">
              <div className="flex items-center justify-between font-medium text-[#CBD5E1]">
                <span>Key Derivation</span>
                <span className="text-purple-400 font-mono text-[11px]">Argon2id</span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                64MB RAM, 4 iterations, resistant to GPU/ASIC attacks.
              </p>
            </div>

            <div className="p-3 bg-[#090D12]/80 border border-[#1F2937] rounded-lg space-y-1">
              <div className="flex items-center justify-between font-medium text-[#CBD5E1]">
                <span>Integrity</span>
                <span className="text-[#22C55E] font-mono text-[11px]">AEAD + SHA-256</span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Tamper detection guarantees ciphertext integrity before decryption.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
