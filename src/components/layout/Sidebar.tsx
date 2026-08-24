import React from 'react';
import {
  LayoutDashboard,
  Lock,
  Unlock,
  ListOrdered,
  History,
  Settings,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { useQueueStore } from '../../stores/useQueueStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { ActiveTab } from '../../types';
import { cn } from '../../utils/cn';

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, isSidebarCollapsed, toggleSidebar } = useUIStore();
  const { operations } = useQueueStore();
  const { settings, setTheme } = useSettingsStore();

  const activeQueueCount = operations.filter(
    (op) => op.status === 'processing' || op.status === 'waiting' || op.status === 'paused'
  ).length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'encrypt', label: 'Encrypt', icon: <Lock className="w-4 h-4" /> },
    { id: 'decrypt', label: 'Decrypt', icon: <Unlock className="w-4 h-4" /> },
    {
      id: 'queue',
      label: 'Queue',
      icon: <ListOrdered className="w-4 h-4" />,
      badge: activeQueueCount > 0 ? activeQueueCount : undefined,
    },
    { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <aside
      className={cn(
        'h-full bg-[#0D1117] border-r border-slate-800/80 flex flex-col justify-between transition-all duration-200 shrink-0 select-none z-10',
        isSidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Top Header & Collapse Button */}
      <div>
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-slate-800/60">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-900/40 shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-slate-100 tracking-tight leading-none">
                  Aegis Crypt
                </span>
                <span className="text-[10px] text-slate-500 font-medium tracking-wide mt-1 uppercase">
                  Security Suite
                </span>
              </div>
            </div>
          )}

          {isSidebarCollapsed && (
            <div className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-900/40">
              <Shield className="w-4 h-4" />
            </div>
          )}

          <button
            onClick={toggleSidebar}
            className={cn(
              'text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/70 transition-colors',
              isSidebarCollapsed && 'hidden'
            )}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar collapse"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-2.5 space-y-1 mt-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 relative group',
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent',
                  isSidebarCollapsed && 'justify-center px-2'
                )}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <span
                  className={cn(
                    'transition-colors shrink-0',
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                >
                  {item.icon}
                </span>

                {!isSidebarCollapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}

                {item.badge !== undefined && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 text-[10px] font-bold rounded-full border leading-none',
                      isActive
                        ? 'bg-blue-500 text-white border-blue-400'
                        : 'bg-blue-950 text-blue-300 border-blue-800/80 animate-pulse',
                      isSidebarCollapsed && 'absolute top-1 right-1 px-1'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-3 border-t border-slate-800/80 space-y-2.5">
        {isSidebarCollapsed ? (
          <button
            onClick={toggleSidebar}
            className="w-full flex justify-center text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800/70 transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        ) : (
          <>
            {/* Privacy indicator */}
            <div className="bg-[#090D12] border border-slate-800/90 rounded-lg p-2.5 flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-slate-300 truncate">
                  Local-Only Mode
                </div>
                <div className="text-[10px] text-slate-500 truncate">Zero cloud telemetry</div>
              </div>
            </div>

            {/* Version & Theme switch */}
            <div className="flex items-center justify-between pt-1 px-1 text-[11px] text-slate-500">
              <span className="font-mono text-[10px] text-slate-500">v1.0.0</span>
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-md">
                <button
                  onClick={() => setTheme('dark')}
                  className={cn(
                    'p-1 rounded text-xs transition-colors',
                    settings.theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  )}
                  title="Dark theme"
                  aria-label="Dark theme"
                >
                  <Moon className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={cn(
                    'p-1 rounded text-xs transition-colors',
                    settings.theme === 'light' ? 'bg-slate-800 text-amber-400' : 'text-slate-500 hover:text-slate-300'
                  )}
                  title="Light theme"
                  aria-label="Light theme"
                >
                  <Sun className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={cn(
                    'p-1 rounded text-xs transition-colors',
                    settings.theme === 'system' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  )}
                  title="System theme"
                  aria-label="System theme"
                >
                  <Laptop className="w-3 h-3" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
