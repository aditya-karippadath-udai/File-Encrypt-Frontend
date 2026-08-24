/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppLayout } from './components/layout/AppLayout';
import { useUIStore } from './stores/useUIStore';
import { DashboardPage } from './pages/DashboardPage';
import { EncryptPage } from './pages/EncryptPage';
import { DecryptPage } from './pages/DecryptPage';
import { QueuePage } from './pages/QueuePage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const { activeTab } = useUIStore();

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
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <AppLayout>
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
    </AppLayout>
  );
}
