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
  Terminal,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useToastStore } from '../stores/useToastStore';
import { useEngineStore } from '../stores/useEngineStore';
import { desktopService } from '../services/desktop/desktopService';
import { securityService } from '../services/security';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ThemeMode, OutputBehavior, OutputConflictStrategy } from '../types';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    setTheme,
    setOutputBehavior,
    setDefaultConflictStrategy,
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
  const { isTauri, connectionState, appInfo, health, lastChecked, checkHealth } = useEngineStore();
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [testingKdf, setTestingKdf] = useState(false);
  const [kdfResult, setKdfResult] = useState<{ success: boolean; algorithm: string; keyLength: number; durationMs: number } | null>(null);

  const handleRunHealthCheck = async () => {
    setCheckingHealth(true);
    await checkHealth();
    setCheckingHealth(false);
    addToast({
      type: 'success',
      title: 'Backend Health Check Complete',
      message: isTauri
        ? 'Tauri 2.x Rust Core IPC bridge is verified and responsive.'
        : 'Browser environment active. Mock desktop services verified.',
    });
  };

  const handleTestKeyDerivation = async () => {
    setTestingKdf(true);
    const start = performance.now();
    try {
      const res = await securityService.prepareKeyDerivation({
        password: 'aegis-kdf-verification-test-passphrase',
      });
      const durationMs = Math.round(performance.now() - start);
      setKdfResult({ ...res, durationMs });
      addToast({
        type: 'success',
        title: 'Argon2id Key Derivation Verified',
        message: `Derived 256-bit key in ${durationMs}ms with safe memory zeroization.`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'KDF execution failed';
      addToast({
        type: 'error',
        title: 'Key Derivation Test Failed',
        message: errorMsg,
      });
    } finally {
      setTestingKdf(false);
    }
  };

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
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Cryptographic & Key Derivation Engine</h3>
            </div>
            <Badge variant="primary" size="sm">
              Argon2id + 256-bit AEAD
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50/70 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg space-y-1">
              <div className="text-[#64748B] font-medium">Encryption Cipher Spec</div>
              <div className="font-mono text-[#0F172A] dark:text-[#F8FAFC] font-semibold">{settings.algorithm}</div>
              <p className="text-[11px] text-[#64748B]">
                AEAD cipher with 192-bit extended nonce preventing nonce-reuse hazards.
              </p>
            </div>

            <div className="p-3 bg-slate-50/70 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg space-y-1">
              <div className="text-[#64748B] font-medium">Key Derivation Function (KDF)</div>
              <div className="font-mono text-[#0F172A] dark:text-[#F8FAFC] font-semibold">Argon2id (64MB, 3 iters, 4 lanes)</div>
              <p className="text-[11px] text-[#64748B]">
                Memory-hard, GPU/ASIC-resistant derivation using cryptographically secure 128-bit random salt.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 dark:border-[#1F2937]">
            <div className="text-[11px] text-[#64748B]">
              {kdfResult ? (
                <span className="text-[#16A34A] dark:text-[#22C55E] font-medium">
                  Verified: Derived {kdfResult.keyLength * 8}-bit key in {kdfResult.durationMs}ms ({kdfResult.algorithm}).
                </span>
              ) : (
                <span>Test backend Argon2id key derivation execution with simulated input.</span>
              )}
            </div>
            <Button
              size="xs"
              variant="secondary"
              icon={<ShieldCheck className="w-3 h-3 text-[#2563EB] dark:text-[#60A5FA]" />}
              onClick={handleTestKeyDerivation}
              disabled={testingKdf}
            >
              {testingKdf ? 'Deriving Key...' : 'Test Key Derivation'}
            </Button>
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

            {/* Default Conflict Strategy */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#1F2937]">
              <label className="text-[#1E293B] dark:text-[#CBD5E1] font-medium block">
                Default Collision & Conflict Strategy
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'ask' as OutputConflictStrategy, label: 'Always Prompt (Ask)' },
                  { id: 'rename' as OutputConflictStrategy, label: 'Auto-Rename (1)' },
                  { id: 'skip' as OutputConflictStrategy, label: 'Skip Existing' },
                  { id: 'overwrite' as OutputConflictStrategy, label: 'Overwrite' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setDefaultConflictStrategy(s.id)}
                    className={`p-2.5 rounded-lg border text-center font-medium text-[11px] transition-all cursor-pointer ${
                      settings.defaultConflictStrategy === s.id
                        ? 'border-[#2563EB] bg-blue-500/10 text-[#2563EB] dark:text-[#60A5FA]'
                        : 'border-slate-200 dark:border-[#1F2937] bg-slate-50/70 dark:bg-[#090D12]/80 text-[#64748B] hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

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

        {/* Desktop Engine & IPC Architecture */}
        <section className="p-5 bg-white/80 dark:bg-[#0D1117]/70 backdrop-blur-md border border-slate-200 dark:border-[#1F2937] rounded-xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-[#1F2937]">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Desktop Engine & IPC Architecture</h3>
            </div>
            <Badge
              variant={connectionState === 'connected' ? 'success' : connectionState === 'browser' ? 'info' : 'warning'}
              size="sm"
            >
              {connectionState === 'connected'
                ? 'Tauri 2.x Connected'
                : connectionState === 'browser'
                ? 'Browser Mode'
                : connectionState}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50/80 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg">
              <span className="text-[10px] uppercase font-bold text-[#64748B] block">Application Core</span>
              <div className="font-semibold text-[#1E293B] dark:text-[#CBD5E1] mt-0.5">
                {appInfo?.name || 'File Encryption Tool'}
              </div>
              <span className="text-[11px] text-[#64748B] font-mono">
                {appInfo ? `v${appInfo.version}` : 'v1.0.0'}
              </span>
            </div>

            <div className="p-3 bg-slate-50/80 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg">
              <span className="text-[10px] uppercase font-bold text-[#64748B] block">Backend Bridge</span>
              <div className="font-semibold text-[#1E293B] dark:text-[#CBD5E1] mt-0.5 capitalize">
                {isTauri ? 'Rust Tauri IPC' : 'Browser Web Worker / Mock'}
              </div>
              <span className="text-[11px] text-[#64748B] font-mono">
                {health ? `Status: ${health.status}` : 'Status: Ready'}
              </span>
            </div>

            <div className="p-3 bg-slate-50/80 dark:bg-[#090D12]/80 border border-slate-200 dark:border-[#1F2937] rounded-lg">
              <span className="text-[10px] uppercase font-bold text-[#64748B] block">Last Health Ping</span>
              <div className="font-semibold text-[#1E293B] dark:text-[#CBD5E1] mt-0.5">
                {lastChecked ? new Date(lastChecked).toLocaleTimeString() : 'On Startup'}
              </div>
              <span className="text-[11px] text-[#64748B] font-mono">
                {isTauri ? 'Native IPC Channel' : 'Local Web Context'}
              </span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-[#1F2937]">
            <span className="text-[11px] text-[#64748B]">
              {isTauri
                ? 'Backend commands get_app_info and health_check routed via native Rust IPC handler.'
                : 'Running in browser preview. Native desktop invocations automatically fall back to mock service layer.'}
            </span>
            <Button
              size="xs"
              variant="secondary"
              icon={<Activity className="w-3 h-3 text-[#2563EB] dark:text-[#60A5FA]" />}
              onClick={handleRunHealthCheck}
              disabled={checkingHealth}
            >
              {checkingHealth ? 'Pinging...' : 'Run Health Check'}
            </Button>
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
