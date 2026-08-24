import React from 'react';
import { ShieldCheck, ShieldAlert, Check, X } from 'lucide-react';
import { evaluatePasswordStrength } from '../../utils/passwordStrength';
import { cn } from '../../utils/cn';

export interface PasswordStrengthMeterProps {
  password?: string;
  showSuggestions?: boolean;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password = '',
  showSuggestions = true,
}) => {
  const evalResult = evaluatePasswordStrength(password);

  if (!password) return null;

  const scoreBars = [1, 2, 3, 4];

  return (
    <div className="space-y-2 p-3 bg-[#090D12] border border-slate-800/90 rounded-lg text-xs">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 font-medium flex items-center gap-1.5">
          {evalResult.score >= 3 ? (
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          )}
          Password Strength
        </span>
        <span className={cn('font-semibold font-mono text-xs', evalResult.color)}>
          {evalResult.label}
        </span>
      </div>

      {/* Strength Segments */}
      <div className="grid grid-cols-4 gap-1.5">
        {scoreBars.map((barIndex) => {
          const isActive = barIndex <= evalResult.score;
          return (
            <div
              key={barIndex}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                isActive ? evalResult.bgGradient : 'bg-slate-800'
              )}
            />
          );
        })}
      </div>

      {/* Rules checklist */}
      {showSuggestions && (
        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            {evalResult.hasMinLength ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <X className="w-3 h-3 text-slate-600" />
            )}
            <span className={evalResult.hasMinLength ? 'text-slate-300' : 'text-slate-500'}>
              8+ characters
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {evalResult.hasUppercase && evalResult.hasLowercase ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <X className="w-3 h-3 text-slate-600" />
            )}
            <span
              className={
                evalResult.hasUppercase && evalResult.hasLowercase
                  ? 'text-slate-300'
                  : 'text-slate-500'
              }
            >
              Upper & lower case
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {evalResult.hasNumber ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <X className="w-3 h-3 text-slate-600" />
            )}
            <span className={evalResult.hasNumber ? 'text-slate-300' : 'text-slate-500'}>
              Number (0-9)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {evalResult.hasSymbol ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <X className="w-3 h-3 text-slate-600" />
            )}
            <span className={evalResult.hasSymbol ? 'text-slate-300' : 'text-slate-500'}>
              Special symbol
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
