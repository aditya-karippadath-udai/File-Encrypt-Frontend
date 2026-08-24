import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  label,
  error,
  helperText,
  className,
  value,
  onChange,
  disabled,
  placeholder = 'Enter encryption password',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <div className="flex items-center justify-between text-xs">
          <label className="font-semibold text-[#CBD5E1]">{label}</label>
          <span className="text-[11px] text-[#64748B] font-mono">Argon2id Salted</span>
        </div>
      )}

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#64748B]">
          <KeyRound className="w-4 h-4" />
        </div>

        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'w-full bg-[#090D12]/80 border rounded-lg pl-9 pr-10 py-2 text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/40 focus:border-[#2563EB] transition-colors font-mono tracking-tight',
            error
              ? 'border-[#EF4444]/60 focus:border-[#EF4444] focus:ring-[#EF4444]/30'
              : 'border-[#1F2937] hover:border-slate-700',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
          {...props}
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled || !value}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#64748B] hover:text-[#CBD5E1] transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          title={showPassword ? 'Hide password' : 'Show password'}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {error ? (
        <p className="text-xs text-[#EF4444] font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-[#64748B]">{helperText}</p>
      ) : null}
    </div>
  );
};
