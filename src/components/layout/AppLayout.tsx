import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { RecoveryBanner } from './RecoveryBanner';
import { ToastContainer } from '../ui/ToastContainer';
import { FileDetailsModal } from '../files/FileDetailsModal';
import { useUIStore } from '../../stores/useUIStore';
import { useEngineStore } from '../../stores/useEngineStore';
import { ActiveTab } from '../../types';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { setActiveTab } = useUIStore();
  const { checkHealth } = useEngineStore();

  // Run backend IPC handshake & health check on startup
  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Keyboard shortcut listener for desktop productivity
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when focused in an input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('dashboard');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('encrypt');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('decrypt');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveTab('queue');
        } else if (e.key === '5') {
          e.preventDefault();
          setActiveTab('history');
        } else if (e.key === '6') {
          e.preventDefault();
          setActiveTab('session');
        } else if (e.key === '7' || e.key === ',') {
          e.preventDefault();
          setActiveTab('settings');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  return (
    <div className="flex h-screen w-screen bg-[#F4F6F9] dark:bg-[#05070A] text-[#0F172A] dark:text-[#F8FAFC] overflow-hidden relative selection:bg-blue-500/30 transition-colors duration-200">
      {/* Ambient background glows for frosted glass reflection */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-[30rem] h-[30rem] bg-indigo-500/5 dark:bg-indigo-600/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-10 w-72 h-72 bg-purple-500/5 dark:bg-purple-600/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Collapsible Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-transparent">
        {/* Top Header */}
        <Header />

        {/* Stale Temp File Recovery Banner */}
        <RecoveryBanner />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Global Modals & Notifications */}
      <FileDetailsModal />
      <ToastContainer />
    </div>
  );
};

