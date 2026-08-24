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
      'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm shadow-blue-900/30 border border-blue-500/30',
    secondary:
      'bg-[#161F2E] hover:bg-[#1E293B] active:bg-[#0F172A] text-slate-200 border border-slate-700/60 shadow-sm',
    outline:
      'bg-transparent hover:bg-slate-800/60 text-slate-300 border border-slate-700/80 hover:text-white',
    ghost:
      'bg-transparent hover:bg-slate-800/50 active:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent',
    danger:
      'bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50',
    success:
      'bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30',
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
