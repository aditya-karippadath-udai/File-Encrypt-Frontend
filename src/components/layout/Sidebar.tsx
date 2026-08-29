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
import { useEngineStore } from '../../stores/useEngineStore';
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
  const { connectionState, checkHealth, appInfo } = useEngineStore();

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
        'h-full bg-white/80 dark:bg-[#090D12]/80 backdrop-blur-xl border-r border-[#E2E8F0] dark:border-[#1F2937] flex flex-col justify-between transition-all duration-200 shrink-0 select-none z-10',
        isSidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Top Header & Collapse Button */}
      <div>
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1F2937]">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight leading-none">
                  Aegis Crypt
                </span>
                <span className="text-[10px] text-[#64748B] font-medium tracking-wider mt-1 uppercase">
                  Security Suite
                </span>
              </div>
            </div>
          )}

          {isSidebarCollapsed && (
            <div className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Shield className="w-4 h-4" />
            </div>
          )}

          <button
            onClick={toggleSidebar}
            className={cn(
              'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#CBD5E1] p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1F2937]/50 transition-colors cursor-pointer',
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
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 relative group cursor-pointer',
                  isActive
                    ? 'bg-[#2563EB]/10 dark:bg-[#1F2937]/70 text-[#2563EB] dark:text-[#60A5FA] border border-[#2563EB]/30 dark:border-[#2563EB]/40 font-semibold shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#1F2937]/40 border border-transparent',
                  isSidebarCollapsed && 'justify-center px-2'
                )}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <span
                  className={cn(
                    'transition-colors shrink-0',
                    isActive
                      ? 'text-[#2563EB] dark:text-[#60A5FA]'
                      : 'text-[#64748B] group-hover:text-[#0F172A] dark:group-hover:text-[#CBD5E1]'
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
                        ? 'bg-[#2563EB] text-white border-blue-400'
                        : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800/80 animate-pulse',
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
      <div className="p-3 border-t border-[#E2E8F0] dark:border-[#1F2937] space-y-2.5">
        {isSidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                connectionState === 'connected' && 'bg-[#16A34A] dark:bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.6)]',
                connectionState === 'browser' && 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
                connectionState === 'connecting' && 'bg-amber-400 animate-ping',
                connectionState === 'unavailable' && 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
              )}
              title={
                connectionState === 'connected'
                  ? 'Desktop Engine Connected (Tauri 2.x Rust)'
                  : connectionState === 'browser'
                  ? 'Browser Mode (Mock desktop services active)'
                  : connectionState === 'connecting'
                  ? 'Connecting to Desktop Engine...'
                  : 'Desktop Engine Unavailable'
              }
            />
            <button
              onClick={toggleSidebar}
              className="w-full flex justify-center text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#CBD5E1] p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1F2937]/50 transition-colors cursor-pointer"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Backend Engine Status Indicator */}
            <div className="bg-slate-50/80 dark:bg-[#0D1117]/80 border border-[#E2E8F0] dark:border-[#1F2937] rounded-xl p-3 backdrop-blur-md flex flex-col gap-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  {connectionState === 'connected'
                    ? 'Desktop Engine'
                    : connectionState === 'browser'
                    ? 'Runtime Mode'
                    : 'Engine Status'}
                </span>
                <div
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    connectionState === 'connected' && 'bg-[#16A34A] dark:bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.6)]',
                    connectionState === 'browser' && 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
                    connectionState === 'connecting' && 'bg-amber-400 animate-pulse',
                    connectionState === 'unavailable' && 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                  )}
                />
              </div>
              <p className="text-[11px] font-medium text-[#1E293B] dark:text-[#E2E8F0] leading-tight">
                {connectionState === 'connected' && 'Desktop Engine Connected'}
                {connectionState === 'browser' && 'Browser Mode'}
                {connectionState === 'connecting' && 'Connecting to Engine...'}
                {connectionState === 'unavailable' && 'Desktop Engine Unavailable'}
              </p>
              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] leading-tight">
                {connectionState === 'connected' && 'Tauri 2.x Rust core active.'}
                {connectionState === 'browser' && 'Mock desktop services active.'}
                {connectionState === 'connecting' && 'Verifying IPC bridge...'}
                {connectionState === 'unavailable' && 'Some desktop features may be limited.'}
              </p>
            </div>

            {/* Version & Theme switch */}
            <div className="flex items-center justify-between pt-1 px-1 text-[11px] text-[#64748B]">
              <span className="font-mono text-[10px] text-[#64748B]">
                {appInfo ? `v${appInfo.version}` : 'v1.0.0'}
              </span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#1F2937] p-0.5 rounded-md">
                <button
                  onClick={() => setTheme('dark')}
                  className={cn(
                    'p-1 rounded text-xs transition-colors cursor-pointer',
                    settings.theme === 'dark'
                      ? 'bg-white dark:bg-[#1F2937] text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#CBD5E1]'
                  )}
                  title="Dark theme"
                  aria-label="Dark theme"
                >
                  <Moon className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={cn(
                    'p-1 rounded text-xs transition-colors cursor-pointer',
                    settings.theme === 'light'
                      ? 'bg-white dark:bg-[#1F2937] text-amber-500 shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#CBD5E1]'
                  )}
                  title="Light theme"
                  aria-label="Light theme"
                >
                  <Sun className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={cn(
                    'p-1 rounded text-xs transition-colors cursor-pointer',
                    settings.theme === 'system'
                      ? 'bg-white dark:bg-[#1F2937] text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#CBD5E1]'
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
