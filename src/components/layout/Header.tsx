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
    <header className="h-14 border-b border-[#1F2937] bg-[#090D12]/75 backdrop-blur-xl px-5 flex items-center justify-between shrink-0 select-none z-20">
      {/* Left: Engine Status Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2563EB]/15 border border-[#2563EB]/30 flex items-center justify-center text-[#60A5FA] shadow-xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#F8FAFC] tracking-wider">AEGIS CRYPT</span>
              <span className="text-[10px] text-[#64748B] font-mono">DESKTOP</span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 ml-4 pl-4 border-l border-[#1F2937]">
          <Badge variant="neutral" size="sm" icon={<Cpu className="w-3 h-3 text-[#60A5FA]" />}>
            <span className="font-mono text-[10px] text-[#CBD5E1]">XChaCha20-Poly1305</span>
          </Badge>
          <Badge variant="neutral" size="sm" icon={<HardDrive className="w-3 h-3 text-purple-400" />}>
            <span className="font-mono text-[10px] text-[#CBD5E1]">Argon2id KDF</span>
          </Badge>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#22C55E] font-medium ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
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
            className="flex items-center gap-2 px-3 py-1.5 bg-[#2563EB]/15 hover:bg-[#2563EB]/25 border border-[#2563EB]/30 rounded-lg text-xs text-[#93C5FD] backdrop-blur-md transition-colors animate-pulse cursor-pointer"
          >
            <ListOrdered className="w-3.5 h-3.5 text-[#60A5FA]" />
            <span>
              {processingCount > 0 ? `${processingCount} processing` : `${waitingCount} waiting`}
            </span>
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={cycleTheme}
          title={`Theme: ${settings.theme} (Click to toggle)`}
          className="w-8 h-8 rounded-lg bg-[#111827]/80 hover:bg-[#1F2937] border border-[#1F2937] flex items-center justify-center transition-colors text-[#CBD5E1] hover:text-white cursor-pointer backdrop-blur-md"
          aria-label="Toggle theme"
        >
          {getThemeIcon()}
        </button>

        {/* Settings shortcut button */}
        <button
          onClick={() => setActiveTab('settings')}
          className="w-8 h-8 rounded-lg bg-[#111827]/80 hover:bg-[#1F2937] border border-[#1F2937] flex items-center justify-center transition-colors text-[#CBD5E1] hover:text-white cursor-pointer backdrop-blur-md"
          aria-label="Open Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
