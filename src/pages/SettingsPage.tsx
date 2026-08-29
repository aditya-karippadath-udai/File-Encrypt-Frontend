import React, { useState } from 'react';
import {
  Settings,
  Sun,
  Moon,
  Laptop,
  Cpu,
  HardDrive,
  Folder,
  ShieldCheck,
  Zap,
  RotateCcw,
  Check,
  Lock,
} from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useToastStore } from '../stores/useToastStore';
import { desktopService } from '../services/desktop/mockDesktopService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ThemeMode, OutputBehavior } from '../types';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    setTheme,
    setOutputBehavior,
    setCustomOutputPath,
    setPreserveOriginal,
    setOverwriteProtection,
    setAutoClearQueue,
    setAutoClearDelaySec,
    setConcurrency,
    setChunkSizeMb,
    resetSettings,
  } = useSettingsStore();

  const { addToast } = useToastStore();

  const handleSelectCustomDir = async () => {
    const dir = await desktopService.selectDirectory();
    if (dir) {
      setCustomOutputPath(dir);
      addToast({
        type: 'success',
        title: 'Output Directory Updated',
        message: `Default output set to ${dir}`,
      });
    }
  };

  const handleReset = () => {
    resetSettings();
    addToast({
      type: 'info',
      title: 'Settings Reset',
      message: 'Restored system default preferences.',
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
            Application Settings
          </h1>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
            Configure UI appearance, cryptographic parameters, and local file operations.
          </p>
        </div>

        <Button
          size="xs"
          variant="outline"
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={handleReset}
        >
          Reset Defaults
        </Button>
      </div>

      <div className="space-y-5">
        {/* Appearance Section */}
        <section className="p-5 bg-white/80 dark:bg-[#0D1117]/70 backdrop-blur-md border border-slate-200 dark:border-[#1F2937] rounded-xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-[#1F2937]">
            <Sun className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Appearance</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'dark' as ThemeMode, label: 'Dark Mode', icon: <Moon className="w-4 h-4" /> },
              { id: 'light' as ThemeMode, label: 'Light Mode', icon: <Sun className="w-4 h-4" /> },
              { id: 'system' as ThemeMode, label: 'System Sync', icon: <Laptop className="w-4 h-4" /> },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer ${
                  settings.theme === t.id
                    ? 'border-[#2563EB] bg-blue-500/10 text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                    : 'border-slate-200 dark:border-[#1F2937] bg-slate-50/70 dark:bg-[#090D12]/80 text-[#64748B] hover:border-slate-300 dark:hover:border-slate-700 hover:text-[#0F172A] dark:hover:text-[#CBD5E1]'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Cryptographic Information Section */}
        <section className="p-5 bg-white/80 dark:bg-[#0D1117]/70 backdrop-blur-md border border-slate-200 dark:border-[#1F2937] rounded-xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#1F2937]">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Cryptographic Engine</h3>
            </div>
            <Badge variant="primary" size="sm">
              Standard Spec
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50/70 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg space-y-1">
              <div className="text-[#64748B] font-medium">Encryption Cipher</div>
              <div className="font-mono text-[#0F172A] dark:text-[#F8FAFC] font-semibold">{settings.algorithm}</div>
              <p className="text-[11px] text-[#64748B]">
                AEAD cipher with 192-bit extended nonce preventing nonce-reuse hazards.
              </p>
            </div>

            <div className="p-3 bg-slate-50/70 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg space-y-1">
              <div className="text-[#64748B] font-medium">Key Derivation Function (KDF)</div>
              <div className="font-mono text-[#0F172A] dark:text-[#F8FAFC] font-semibold">{settings.keyDerivation}</div>
              <p className="text-[11px] text-[#64748B]">
                Winner of Password Hashing Competition; memory-hard resistant to GPU mining.
              </p>
            </div>
          </div>
        </section>

        {/* File Operation Options */}
        <section className="p-5 bg-white/80 dark:bg-[#0D1117]/70 backdrop-blur-md border border-slate-200 dark:border-[#1F2937] rounded-xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-[#1F2937]">
            <Folder className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">File Output & Safety</h3>
          </div>

          <div className="space-y-4 text-xs">
            {/* Output Behavior */}
            <div className="space-y-2">
              <label className="text-[#1E293B] dark:text-[#CBD5E1] font-medium block">Default Output Location</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'same-folder' as OutputBehavior, label: 'Same folder as input' },
                  { id: 'custom-folder' as OutputBehavior, label: 'Custom Vault folder' },
                  { id: 'ask' as OutputBehavior, label: 'Always prompt' },
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setOutputBehavior(b.id)}
                    className={`p-2.5 rounded-lg border text-left font-medium transition-all cursor-pointer ${
                      settings.outputBehavior === b.id
                        ? 'border-[#2563EB] bg-blue-500/10 text-[#2563EB] dark:text-[#60A5FA]'
                        : 'border-slate-200 dark:border-[#1F2937] bg-slate-50/70 dark:bg-[#090D12]/80 text-[#64748B] hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {settings.outputBehavior === 'custom-folder' && (
              <div className="flex items-center gap-2 p-2 bg-slate-50/70 dark:bg-[#090D12]/80 rounded-lg border border-slate-200 dark:border-[#1F2937]">
                <span className="font-mono text-[#0F172A] dark:text-[#CBD5E1] truncate flex-1 pl-1">
                  {settings.customOutputPath}
                </span>
                <Button size="xs" variant="secondary" onClick={handleSelectCustomDir}>
                  Browse...
                </Button>
              </div>
            )}

            {/* Toggles */}
            <div className="pt-2 border-t border-slate-200 dark:border-[#1F2937] space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-medium text-[#1E293B] dark:text-[#CBD5E1]">Preserve Original Files</div>
                  <div className="text-[11px] text-[#64748B]">
                    Do not shred or remove original plain files after successful encryption.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.preserveOriginal}
                  onChange={(e) => setPreserveOriginal(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2563EB] focus:ring-[#2563EB] border-slate-300 dark:border-[#1F2937] bg-white dark:bg-[#090D12]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-medium text-[#1E293B] dark:text-[#CBD5E1]">Overwrite Protection</div>
                  <div className="text-[11px] text-[#64748B]">
                    Prompt before replacing existing files with the same name.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.overwriteProtection}
                  onChange={(e) => setOverwriteProtection(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2563EB] focus:ring-[#2563EB] border-slate-300 dark:border-[#1F2937] bg-white dark:bg-[#090D12]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-medium text-[#1E293B] dark:text-[#CBD5E1]">Auto-Clear Queue on Complete</div>
                  <div className="text-[11px] text-[#64748B]">
                    Automatically dismiss completed items from the queue.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoClearQueue}
                  onChange={(e) => setAutoClearQueue(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2563EB] focus:ring-[#2563EB] border-slate-300 dark:border-[#1F2937] bg-white dark:bg-[#090D12]"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Performance Options */}
        <section className="p-5 bg-white/80 dark:bg-[#0D1117]/70 backdrop-blur-md border border-slate-200 dark:border-[#1F2937] rounded-xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-[#1F2937]">
            <Zap className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Performance & Concurrency</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-[#1E293B] dark:text-[#CBD5E1]">Concurrent Operations</label>
              <select
                value={settings.concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg p-2 text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
              >
                <option value={1}>1 Worker (Sequential)</option>
                <option value={2}>2 Workers (Balanced)</option>
                <option value={4}>4 Workers (Multi-core)</option>
                <option value={8}>8 Workers (High Throughput)</option>
              </select>
              <span className="text-[11px] text-[#64748B] block">
                Number of files processed simultaneously.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-[#1E293B] dark:text-[#CBD5E1]">Chunk Buffer Size</label>
              <select
                value={settings.chunkSizeMb}
                onChange={(e) => setChunkSizeMb(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg p-2 text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB]"
              >
                <option value={1}>1 MB (Low Memory)</option>
                <option value={4}>4 MB (Recommended)</option>
                <option value={16}>16 MB (Fast NVMe)</option>
                <option value={64}>64 MB (Maximum Throughput)</option>
              </select>
              <span className="text-[11px] text-[#64748B] block">
                Block size for chunked streaming cipher engine.
              </span>
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section className="p-5 bg-white/80 dark:bg-[#090D12]/80 backdrop-blur-md border border-[#2563EB]/30 rounded-xl space-y-2 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#16A34A] dark:text-[#22C55E]" />
            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Local Processing Guarantee</h3>
          </div>
          <p className="text-xs text-[#64748B] dark:text-[#CBD5E1] leading-relaxed">
            Your files and master passwords are processed entirely on your local machine. No file data,
            passwords, or cryptographic hashes are ever transmitted over the network or stored on remote servers.
          </p>
        </section>
      </div>
    </div>
  );
};
