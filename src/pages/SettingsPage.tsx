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
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            Application Settings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
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
        <section className="p-5 bg-[#0D1117] border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <Sun className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-100">Appearance</h3>
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
                    ? 'border-blue-500/80 bg-blue-500/10 text-blue-300 shadow-sm'
                    : 'border-slate-800 bg-[#090D12] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Cryptography Information Section */}
        <section className="p-5 bg-[#0D1117] border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-100">Cryptographic Engine</h3>
            </div>
            <Badge variant="primary" size="sm">
              Standard Spec
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#090D12] border border-slate-800/80 rounded-lg space-y-1">
              <div className="text-slate-400 font-medium">Encryption Cipher</div>
              <div className="font-mono text-slate-200 font-semibold">{settings.algorithm}</div>
              <p className="text-[11px] text-slate-500">
                AEAD cipher with 192-bit extended nonce preventing nonce-reuse hazards.
              </p>
            </div>

            <div className="p-3 bg-[#090D12] border border-slate-800/80 rounded-lg space-y-1">
              <div className="text-slate-400 font-medium">Key Derivation Function (KDF)</div>
              <div className="font-mono text-slate-200 font-semibold">{settings.keyDerivation}</div>
              <p className="text-[11px] text-slate-500">
                Winner of Password Hashing Competition; memory-hard resistant to GPU mining.
              </p>
            </div>
          </div>
        </section>

        {/* File Operation Options */}
        <section className="p-5 bg-[#0D1117] border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <Folder className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-100">File Output & Safety</h3>
          </div>

          <div className="space-y-4 text-xs">
            {/* Output Behavior */}
            <div className="space-y-2">
              <label className="text-slate-300 font-medium block">Default Output Location</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'same-folder' as OutputBehavior, label: 'Same folder as input' },
                  { id: 'custom-folder' as OutputBehavior, label: 'Custom Vault folder' },
                  { id: 'ask' as OutputBehavior, label: 'Always prompt' },
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setOutputBehavior(b.id)}
                    className={`p-2.5 rounded-lg border text-left font-medium transition-all ${
                      settings.outputBehavior === b.id
                        ? 'border-blue-500/60 bg-blue-500/10 text-blue-300'
                        : 'border-slate-800 bg-[#090D12] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {settings.outputBehavior === 'custom-folder' && (
              <div className="flex items-center gap-2 p-2 bg-[#090D12] rounded-lg border border-slate-800">
                <span className="font-mono text-slate-300 truncate flex-1 pl-1">
                  {settings.customOutputPath}
                </span>
                <Button size="xs" variant="secondary" onClick={handleSelectCustomDir}>
                  Browse...
                </Button>
              </div>
            )}

            {/* Toggles */}
            <div className="pt-2 border-t border-slate-800/80 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-medium text-slate-200">Preserve Original Files</div>
                  <div className="text-[11px] text-slate-500">
                    Do not shred or remove original plain files after successful encryption.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.preserveOriginal}
                  onChange={(e) => setPreserveOriginal(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-900"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-medium text-slate-200">Overwrite Protection</div>
                  <div className="text-[11px] text-slate-500">
                    Prompt before replacing existing files with the same name.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.overwriteProtection}
                  onChange={(e) => setOverwriteProtection(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-900"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-medium text-slate-200">Auto-Clear Queue on Complete</div>
                  <div className="text-[11px] text-slate-500">
                    Automatically dismiss completed items from the queue.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoClearQueue}
                  onChange={(e) => setAutoClearQueue(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-700 bg-slate-900"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Performance Options */}
        <section className="p-5 bg-[#0D1117] border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <Zap className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-100">Performance & Concurrency</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-slate-300">Concurrent Operations</label>
              <select
                value={settings.concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-full bg-[#090D12] border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value={1}>1 Worker (Sequential)</option>
                <option value={2}>2 Workers (Balanced)</option>
                <option value={4}>4 Workers (Multi-core)</option>
                <option value={8}>8 Workers (High Throughput)</option>
              </select>
              <span className="text-[11px] text-slate-500 block">
                Number of files processed simultaneously.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300">Chunk Buffer Size</label>
              <select
                value={settings.chunkSizeMb}
                onChange={(e) => setChunkSizeMb(Number(e.target.value))}
                className="w-full bg-[#090D12] border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value={1}>1 MB (Low Memory)</option>
                <option value={4}>4 MB (Recommended)</option>
                <option value={16}>16 MB (Fast NVMe)</option>
                <option value={64}>64 MB (Maximum Throughput)</option>
              </select>
              <span className="text-[11px] text-slate-500 block">
                Block size for chunked streaming cipher engine.
              </span>
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section className="p-5 bg-gradient-to-r from-[#0D1117] via-[#09131d] to-[#0D1117] border border-blue-900/30 rounded-xl space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">Local Processing Guarantee</h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Your files and master passwords are processed entirely on your local machine. No file data,
            passwords, or cryptographic hashes are ever transmitted over the network or stored on remote servers.
          </p>
        </section>
      </div>
    </div>
  );
};
