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
          success: <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0 mt-0.5" />,
          error: <AlertCircle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
          info: <Info className="w-5 h-5 text-[#60A5FA] shrink-0 mt-0.5" />,
        };

        const borderColors = {
          success: 'border-[#22C55E]/40 bg-[#22C55E]/10 text-white',
          error: 'border-[#EF4444]/40 bg-[#EF4444]/10 text-white',
          warning: 'border-amber-500/40 bg-amber-500/10 text-white',
          info: 'border-[#2563EB]/40 bg-[#2563EB]/10 text-white',
        };

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-xl transition-all animate-in slide-in-from-bottom-3 duration-200',
              borderColors[toast.type]
            )}
          >
            {icons[toast.type]}
            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs font-bold leading-tight text-[#F8FAFC]">{toast.title}</h4>
              {toast.message && (
                <p className="text-xs text-[#CBD5E1] mt-0.5 leading-relaxed break-words">
                  {toast.message}
                </p>
              )}
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                  className="mt-2 text-xs font-semibold text-[#60A5FA] hover:text-[#93C5FD] underline underline-offset-2 cursor-pointer"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#64748B] hover:text-[#CBD5E1] p-1 rounded-md hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
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
