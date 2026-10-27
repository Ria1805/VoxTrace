import React from 'react';
import { CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';
import type { Verdict } from '../../types';

interface VerdictChipProps {
  verdict: Verdict | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const VerdictChip: React.FC<VerdictChipProps> = ({
  verdict,
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const v = (verdict || 'UNSCORED').toUpperCase();

  let styles = 'bg-amber-500/15 text-amber-300 border-amber-500/40 glow-unscored';
  let Icon = HelpCircle;
  let label = 'UNSCORED';

  if (v === 'REAL') {
    styles = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 glow-real';
    Icon = CheckCircle2;
    label = 'AUTHENTIC (REAL)';
  } else if (v === 'FAKE' || v === 'TAMPERED_REAL') {
    styles = 'bg-rose-500/15 text-rose-300 border-rose-500/40 glow-fake';
    Icon = AlertOctagon;
    label = v === 'TAMPERED_REAL' ? 'TAMPERED' : 'SYNTHETIC (FAKE)';
  }

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-4 py-1.5 gap-2 font-bold',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-lg border font-mono font-semibold tracking-wide backdrop-blur-md transition-all ${sizeClasses} ${styles} ${className}`}
    >
      {showIcon && <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />}
      <span>{label}</span>
    </span>
  );
};
