export interface PasswordEvaluation {
  score: number; // 0 to 4
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  color: string;
  bgGradient: string;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  suggestions: string[];
}

export function evaluatePasswordStrength(password: string): PasswordEvaluation {
  if (!password) {
    return {
      score: 0,
      label: 'Very Weak',
      color: 'text-slate-500',
      bgGradient: 'bg-slate-700',
      hasMinLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSymbol: false,
      suggestions: ['Enter at least 8 characters'],
    };
  }

  const hasMinLength = password.length >= 8;
  const hasStrongLength = password.length >= 12;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  let rawPoints = 0;
  if (hasMinLength) rawPoints += 1;
  if (hasStrongLength) rawPoints += 1;
  if (hasUppercase && hasLowercase) rawPoints += 1;
  if (hasNumber) rawPoints += 1;
  if (hasSymbol) rawPoints += 1;

  const suggestions: string[] = [];
  if (!hasMinLength) suggestions.push('Use at least 8 characters (12+ recommended)');
  if (!hasUppercase) suggestions.push('Add uppercase letters');
  if (!hasLowercase) suggestions.push('Add lowercase letters');
  if (!hasNumber) suggestions.push('Add numbers');
  if (!hasSymbol) suggestions.push('Add special symbols (!@#$%^&*)');

  let score = 0;
  let label: PasswordEvaluation['label'] = 'Very Weak';
  let color = 'text-red-400';
  let bgGradient = 'bg-red-500';

  if (rawPoints <= 1) {
    score = 1;
    label = 'Weak';
    color = 'text-red-400';
    bgGradient = 'bg-red-500';
  } else if (rawPoints === 2) {
    score = 2;
    label = 'Fair';
    color = 'text-amber-400';
    bgGradient = 'bg-amber-500';
  } else if (rawPoints === 3 || (rawPoints === 4 && password.length < 12)) {
    score = 3;
    label = 'Strong';
    color = 'text-blue-400';
    bgGradient = 'bg-blue-500';
  } else {
    score = 4;
    label = 'Very Strong';
    color = 'text-emerald-400';
    bgGradient = 'bg-emerald-500';
  }

  return {
    score,
    label,
    color,
    bgGradient,
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSymbol,
    suggestions,
  };
}
