/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayout } from './components/layout/AppLayout';
import { useUIStore } from './stores/useUIStore';
import { useQueueStore } from './stores/useQueueStore';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DashboardPage } from './pages/DashboardPage';
import { EncryptPage } from './pages/EncryptPage';
import { DecryptPage } from './pages/DecryptPage';
import { QueuePage } from './pages/QueuePage';
import { HistoryPage } from './pages/HistoryPage';
import { SessionPage } from './pages/SessionPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const { activeTab, setActiveTab } = useUIStore();

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: string }>;
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab as any);
      }
    };
    window.addEventListener('aegis:navigate', handleNavigate);
    return () => window.removeEventListener('aegis:navigate', handleNavigate);
  }, [setActiveTab]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      // Abort active background operations cleanly when the window is closed
      useQueueStore.getState().cancelAll();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'encrypt':
        return <EncryptPage />;
      case 'decrypt':
        return <DecryptPage />;
      case 'queue':
        return <QueuePage />;
      case 'history':
        return <HistoryPage />;
      case 'session':
        return <SessionPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <AppLayout>
      <ErrorBoundary onReset={() => setActiveTab('dashboard')}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="h-full"
          >
            {renderActivePage()}
          </motion.div>
        </AnimatePresence>
      </ErrorBoundary>
    </AppLayout>
  );
}
