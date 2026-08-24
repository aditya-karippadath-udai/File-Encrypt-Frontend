import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from '../ui/ToastContainer';
import { FileDetailsModal } from '../files/FileDetailsModal';
import { useUIStore } from '../../stores/useUIStore';
import { ActiveTab } from '../../types';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { setActiveTab } = useUIStore();

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
        } else if (e.key === '6' || e.key === ',') {
          e.preventDefault();
          setActiveTab('settings');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  return (
    <div className="flex h-screen w-screen bg-[#05070A] text-[#F8FAFC] overflow-hidden">
      {/* Collapsible Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#05070A]">
        {/* Top Header */}
        <Header />

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
