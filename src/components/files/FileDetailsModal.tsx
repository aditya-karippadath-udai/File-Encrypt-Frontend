import React, { useState } from 'react';
import {
  FileText,
  FileArchive,
  FileCode,
  File,
  Lock,
  Copy,
  Check,
  HardDrive,
  Cpu,
  Folder,
  Clock,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { useToastStore } from '../../stores/useToastStore';
import { formatBytes, formatDateTime, formatDurationMs } from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { desktopService } from '../../services/desktop/mockDesktopService';

export const FileDetailsModal: React.FC = () => {
  const { inspectedItem, setInspectedItem } = useUIStore();
  const { addToast } = useToastStore();
  const [copiedHash, setCopiedHash] = useState(false);

  if (!inspectedItem) return null;

  let name = '';
  let size = 0;
  let path = '';
  let statusText = 'Ready';
  let operationText = 'File Details';
  let checksum = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  let durationMs: number | undefined;
  let algorithm = 'XChaCha20-Poly1305 (256-bit)';
  let kdf = 'Argon2id (64MB memory, 4 iterations)';
  let timestamp = Date.now();
  let outputPath = '';

  if (inspectedItem.kind === 'file') {
    const f = inspectedItem.data;
    name = f.name;
    size = f.size;
    path = f.path;
    statusText = f.isEncrypted ? 'Encrypted Container' : 'Ready';
    operationText = f.isEncrypted ? 'Decryption Candidate' : 'Encryption Candidate';
    timestamp = f.lastModified;
  } else if (inspectedItem.kind === 'operation') {
    const op = inspectedItem.data;
    name = op.file.name;
    size = op.file.size;
    path = op.file.path;
    statusText = op.status.toUpperCase();
    operationText = op.type === 'encrypt' ? 'File Encryption' : 'File Decryption';
    checksum = op.checksum || checksum;
    durationMs = op.durationMs;
    algorithm = op.algorithm || algorithm;
    kdf = op.keyDerivation || kdf;
    outputPath = op.outputPath || '';
    timestamp = op.startedAt || Date.now();
  } else if (inspectedItem.kind === 'history') {
    const h = inspectedItem.data;
    name = h.fileName;
    size = h.originalSize;
    path = h.outputPath;
    statusText = h.status.toUpperCase();
    operationText = h.operation === 'encrypt' ? 'Encrypted' : 'Decrypted';
    checksum = h.checksum;
    durationMs = h.durationMs;
    algorithm = h.algorithm;
    outputPath = h.outputPath;
    timestamp = h.timestamp;
  }

  const handleCopyChecksum = async () => {
    const ok = await desktopService.copyToClipboard(checksum);
    if (ok) {
      setCopiedHash(true);
      addToast({
        type: 'info',
        title: 'Checksum Copied',
        message: 'SHA-256 integrity hash copied to clipboard.',
      });
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  return (
    <Modal
      isOpen={Boolean(inspectedItem)}
      onClose={() => setInspectedItem(null)}
      title={
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-slate-100">File Information</span>
        </div>
      }
      description="Cryptographic metadata and local file attributes."
      footer={
        <Button variant="secondary" size="sm" onClick={() => setInspectedItem(null)}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {/* File Header card */}
        <div className="p-3.5 bg-slate-50/80 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/30 flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA] shrink-0">
            {name.endsWith('.enc') ? (
              <Lock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            ) : (
              <FileText className="w-5 h-5 text-[#2563EB] dark:text-[#60A5FA]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">{name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="primary" size="sm">
                {operationText}
              </Badge>
              <span className="text-xs text-[#64748B] font-mono">{formatBytes(size)}</span>
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50/80 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg space-y-1">
            <div className="text-[#64748B] flex items-center gap-1.5 font-medium">
              <Folder className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" /> Source Location
            </div>
            <div className="font-mono text-[#0F172A] dark:text-[#CBD5E1] truncate" title={path}>
              {path || '~/Documents'}
            </div>
          </div>

          <div className="p-3 bg-slate-50/80 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg space-y-1">
            <div className="text-[#64748B] flex items-center gap-1.5 font-medium">
              <Tag className="w-3.5 h-3.5 text-[#16A34A] dark:text-[#22C55E]" /> Status
            </div>
            <div className="font-semibold text-[#16A34A] dark:text-[#22C55E] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] dark:bg-[#22C55E]" />
              {statusText}
            </div>
          </div>

          <div className="p-3 bg-slate-50/80 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg space-y-1">
            <div className="text-[#64748B] flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" /> Cipher Algorithm
            </div>
            <div className="font-mono text-[#0F172A] dark:text-[#CBD5E1] truncate">{algorithm}</div>
          </div>

          <div className="p-3 bg-slate-50/80 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg space-y-1">
            <div className="text-[#64748B] flex items-center gap-1.5 font-medium">
              <HardDrive className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" /> Key Derivation
            </div>
            <div className="font-mono text-[#0F172A] dark:text-[#CBD5E1] truncate">{kdf}</div>
          </div>

          <div className="p-3 bg-slate-50/80 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg space-y-1">
            <div className="text-[#64748B] flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-[#64748B]" /> Timestamp
            </div>
            <div className="font-mono text-[#0F172A] dark:text-[#CBD5E1]">{formatDateTime(timestamp)}</div>
          </div>

          <div className="p-3 bg-slate-50/80 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg space-y-1">
            <div className="text-[#64748B] flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-[#64748B]" /> Processing Time
            </div>
            <div className="font-mono text-[#0F172A] dark:text-[#CBD5E1]">
              {durationMs !== undefined ? formatDurationMs(durationMs) : 'Simulated on execution'}
            </div>
          </div>
        </div>

        {/* Checksum Box */}
        <div className="p-3 bg-slate-50/80 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#64748B] font-medium">SHA-256 Integrity Checksum</span>
            <button
              onClick={handleCopyChecksum}
              className="inline-flex items-center gap-1 text-[#2563EB] dark:text-[#60A5FA] hover:text-blue-700 dark:hover:text-[#93C5FD] transition-colors font-medium cursor-pointer"
            >
              {copiedHash ? <Check className="w-3 h-3 text-[#16A34A] dark:text-[#22C55E]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
            </button>
          </div>
          <p className="font-mono text-[11px] text-[#0F172A] dark:text-[#CBD5E1] bg-slate-100/80 dark:bg-black/40 p-2 rounded border border-slate-200 dark:border-[#1F2937] break-all select-all">
            {checksum}
          </p>
        </div>

        {outputPath && (
          <div className="text-xs text-[#64748B] flex items-center justify-between px-1">
            <span>Output Target:</span>
            <span className="font-mono text-[#0F172A] dark:text-[#CBD5E1]">{outputPath}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
