import { create } from 'zustand';
import { ActiveTab, EncryptionOperation, FileItem, HistoryItem } from '../types';

export type InspectableItem =
  | { kind: 'operation'; data: EncryptionOperation }
  | { kind: 'history'; data: HistoryItem }
  | { kind: 'file'; data: FileItem };

interface UIState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  inspectedItem: InspectableItem | null;
  setInspectedItem: (item: InspectableItem | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (activeTab) => set({ activeTab }),
  isSidebarCollapsed: false,
  setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  inspectedItem: null,
  setInspectedItem: (inspectedItem) => set({ inspectedItem }),
}));
