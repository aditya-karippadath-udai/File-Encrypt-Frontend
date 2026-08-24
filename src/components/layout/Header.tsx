import React from 'react';
import { ShieldCheck, Cpu, HardDrive, ListOrdered, Settings, Sun, Moon, Laptop } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Badge } from '../ui/Badge';

export const Header: React.FC = () => {
  const { setActiveTab } = useUIStore();
  const { operations } = useQueueStore();
  const { settings, setTheme } = useSettingsStore();

  const processingCount = operations.filter((op) => op.status === 'processing').length;
  const waitingCount = operations.filter((op) => op.status === 'waiting').length;

  const cycleTheme = () => {
    if (settings.theme === 'dark') setTheme('light');
    else if (settings.theme === 'light') setTheme('system');
    else setTheme('dark');
  };

  const getThemeIcon = () => {
    if (settings.theme === 'dark') return <Moon className="w-4 h-4 text-slate-300" />;
    if (settings.theme === 'light') return <Sun className="w-4 h-4 text-amber-400" />;
    return <Laptop className="w-4 h-4 text-blue-400" />;
  };

  return (
    <header className="h-14 border-b border-slate-800/80 bg-[#090D12]/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Engine Status Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-200 tracking-wide">AEGIS CRYPT</span>
              <span className="text-[10px] text-slate-500 font-mono">DESKTOP</span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-slate-800">
          <Badge variant="neutral" size="sm" icon={<Cpu className="w-3 h-3 text-blue-400" />}>
            <span className="font-mono text-[10px] text-slate-300">XChaCha20-Poly1305</span>
          </Badge>
          <Badge variant="neutral" size="sm" icon={<HardDrive className="w-3 h-3 text-purple-400" />}>
            <span className="font-mono text-[10px] text-slate-300">Argon2id KDF</span>
          </Badge>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Local Engine Active
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Active Queue pill */}
        {(processingCount > 0 || waitingCount > 0) && (
          <button
            onClick={() => setActiveTab('queue')}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 rounded-lg text-xs text-blue-300 transition-colors animate-pulse"
          >
            <ListOrdered className="w-3.5 h-3.5 text-blue-400" />
            <span>
              {processingCount > 0 ? `${processingCount} processing` : `${waitingCount} waiting`}
            </span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={cycleTheme}
          title={`Theme: ${settings.theme} (Click to toggle)`}
          className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/70 border border-slate-700/60 flex items-center justify-center transition-colors text-slate-300 hover:text-white"
          aria-label="Toggle theme"
        >
          {getThemeIcon()}
        </button>

        {/* Settings shortcut button */}
        <button
          onClick={() => setActiveTab('settings')}
          className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700/70 border border-slate-700/60 flex items-center justify-center transition-colors text-slate-300 hover:text-white"
          aria-label="Open Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
