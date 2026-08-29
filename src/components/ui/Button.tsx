import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none cursor-pointer';

  const variants = {
    primary:
      'bg-[#2563EB] hover:bg-[#1D4ED8] dark:hover:bg-[#3B82F6] active:bg-[#1E40AF] text-white shadow-md shadow-blue-500/20 border border-blue-400/30 font-semibold',
    secondary:
      'bg-slate-100 hover:bg-slate-200 dark:bg-[#111827]/80 dark:hover:bg-[#1F2937] active:bg-slate-300 dark:active:bg-[#0D1117] text-[#334155] dark:text-[#CBD5E1] border border-slate-300 dark:border-[#1F2937] backdrop-blur-md shadow-xs',
    outline:
      'bg-transparent hover:bg-slate-100 dark:hover:bg-[#1F2937]/50 text-[#334155] dark:text-[#CBD5E1] border border-slate-300 dark:border-[#1F2937] hover:text-[#0F172A] dark:hover:text-white backdrop-blur-xs',
    ghost:
      'bg-transparent hover:bg-slate-100 dark:hover:bg-[#1F2937]/40 active:bg-slate-200 dark:active:bg-[#1F2937]/70 text-[#64748B] hover:text-[#0F172A] dark:hover:text-[#CBD5E1] border border-transparent',
    danger:
      'bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-600 dark:text-[#FCA5A5] border border-red-500/30 backdrop-blur-xs',
    success:
      'bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-emerald-600 dark:text-[#86EFAC] border border-emerald-500/30 backdrop-blur-xs',
  };

  const sizes = {
    xs: 'text-xs px-2.5 py-1 rounded-md gap-1.5',
    sm: 'text-xs px-3 py-1.5 rounded-lg gap-2 font-medium',
    md: 'text-sm px-4 py-2 rounded-lg gap-2',
    lg: 'text-base px-5 py-2.5 rounded-xl gap-2.5 font-semibold',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
      )}
      {children}
      {!loading && icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
    </button>
  );
};
