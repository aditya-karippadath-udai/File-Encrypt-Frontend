import { create } from 'zustand';
import { ToastNotification, ToastType } from '../types';
import { generateId } from '../utils/formatters';

interface ToastState {
  toasts: ToastNotification[];
  addToast: (toast: {
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    action?: { label: string; onClick: () => void };
  }) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: ({ type, title, message, duration = 4000, action }) => {
    const id = generateId('toast');
    const newToast: ToastNotification = { id, type, title, message, duration, action };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }

    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearAll: () => set({ toasts: [] }),
}));
