import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore } from '../../stores/useToastStore';
import { cn } from '../../utils/cn';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />,
          error: <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
          info: <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />,
        };

        const borderColors = {
          success: 'border-emerald-500/30 bg-[#0c1a14]/95 text-emerald-100',
          error: 'border-red-500/30 bg-[#1e0f11]/95 text-red-100',
          warning: 'border-amber-500/30 bg-[#1f1709]/95 text-amber-100',
          info: 'border-blue-500/30 bg-[#0c1524]/95 text-blue-100',
        };

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-3 duration-200',
              borderColors[toast.type]
            )}
          >
            {icons[toast.type]}
            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs font-semibold leading-tight text-slate-100">{toast.title}</h4>
              {toast.message && (
                <p className="text-xs text-slate-300/90 mt-0.5 leading-relaxed break-words">
                  {toast.message}
                </p>
              )}
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                  className="mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-white/5 transition-colors shrink-0"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
