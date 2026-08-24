import React from 'react';
import { cn } from '../../utils/cn';

export interface ProgressBarProps {
  value: number; // 0 to 100
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'purple';
  animated?: boolean;
  striped?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  size = 'md',
  variant = 'primary',
  animated = false,
  striped = false,
  className,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  const sizes = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const variants = {
    primary: 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.35)]',
    success: 'bg-emerald-500 shadow-[0_0_12px_rgba(34,197,94,0.35)]',
    warning: 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.35)]',
    danger: 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.35)]',
    purple: 'bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.35)]',
  };

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'w-full bg-[#111827] rounded-full overflow-hidden border border-slate-800/80 relative',
        sizes[size],
        className
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-200 ease-out',
          variants[variant],
          striped && 'bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem]',
          animated && 'animate-[progress-stripe_1s_linear_infinite]'
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};
